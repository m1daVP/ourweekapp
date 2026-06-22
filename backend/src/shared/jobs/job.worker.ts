import { setTimeout as wait } from 'node:timers/promises';

import { isApiError } from '../errors/index.js';
import { jobEnvelopeSchema, type JobEnvelope } from './job.schema.js';
import type { DequeuedBackgroundJob } from './job.queue.js';

const DEFAULT_HANDLER_ABORT_GRACE_MS = 5_000;
const DEFAULT_MAINTENANCE_INTERVAL_MS = 60 * 60 * 1_000;
const DEAD_LETTER_PURGE_LIMIT = 500;

type QueueOperation =
  | 'read'
  | 'acknowledge'
  | 'extend_visibility'
  | 'dead_letter'
  | 'maintenance';

export type JobHandlerContext = {
  signal: AbortSignal;
};

export type JobHandler = (
  job: JobEnvelope,
  context: JobHandlerContext,
) => Promise<void>;

export type BackgroundJobQueuePort = {
  readOne(visibilityTimeoutSeconds: number): Promise<DequeuedBackgroundJob | null>;
  acknowledge(messageId: number): Promise<void>;
  extendVisibility(messageId: number, visibilityTimeoutSeconds: number): Promise<void>;
  deadLetter(messageId: number, errorCode: string): Promise<void>;
  purgeDeadLetters(before: string, limit?: number): Promise<number>;
};

export type JobWorkerLogger = {
  info(input: Record<string, unknown>, message?: string): void;
  warn(input: Record<string, unknown>, message?: string): void;
  error(input: Record<string, unknown>, message?: string): void;
};

type Sleep = (delayMs: number, signal: AbortSignal) => Promise<void>;

export type JobWorkerOptions = {
  queue: BackgroundJobQueuePort;
  handlers: ReadonlyMap<string, JobHandler>;
  logger: JobWorkerLogger;
  pollIntervalMs: number;
  visibilityTimeoutSeconds: number;
  maxAttempts: number;
  maxConsecutiveQueueFailures: number;
  handlerTimeoutMs: number;
  deadLetterRetentionMs: number;
  maxPollBackoffMs?: number;
  handlerAbortGraceMs?: number;
  leaseRenewalIntervalMs?: number;
  maintenanceIntervalMs?: number;
  now?: () => number;
  sleep?: Sleep;
};

type HandlerOutcome =
  | { kind: 'completed' }
  | { kind: 'failed' }
  | { kind: 'timed_out' }
  | { kind: 'lease_failed'; error: unknown };

export class FatalJobWorkerError extends Error {
  constructor(
    public readonly code: string,
    public readonly operation?: QueueOperation,
  ) {
    super(code);
    this.name = 'FatalJobWorkerError';
  }
}

async function abortableSleep(delayMs: number, signal: AbortSignal) {
  await wait(delayMs, undefined, { signal });
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function safeQueueError(error: unknown) {
  if (isApiError(error)) {
    return { errorCode: error.code, statusCode: error.statusCode };
  }

  return { errorCode: 'background_job_worker_error' };
}

export class JobWorker {
  private readonly sleep: Sleep;
  private readonly maxPollBackoffMs: number;
  private readonly handlerAbortGraceMs: number;
  private readonly leaseRenewalIntervalMs: number;
  private readonly maintenanceIntervalMs: number;
  private readonly now: () => number;
  private readonly queueFailureCounts = new Map<QueueOperation, number>();
  private nextMaintenanceAtMs = 0;

  constructor(private readonly options: JobWorkerOptions) {
    this.sleep = options.sleep ?? abortableSleep;
    this.maxPollBackoffMs =
      options.maxPollBackoffMs ?? Math.max(30_000, options.pollIntervalMs);
    this.handlerAbortGraceMs =
      options.handlerAbortGraceMs ?? DEFAULT_HANDLER_ABORT_GRACE_MS;
    this.leaseRenewalIntervalMs =
      options.leaseRenewalIntervalMs ??
      Math.max(250, Math.floor((options.visibilityTimeoutSeconds * 1_000) / 3));
    this.maintenanceIntervalMs =
      options.maintenanceIntervalMs ?? DEFAULT_MAINTENANCE_INTERVAL_MS;
    this.now = options.now ?? Date.now;
  }

  async run(signal: AbortSignal) {
    let pollBackoffMs = this.options.pollIntervalMs;

    this.options.logger.info(
      { event: 'background_job_worker_started' },
      'Background job worker started',
    );

    try {
      while (!signal.aborted) {
        try {
          await this.runMaintenanceIfDue();
          if (signal.aborted) {
            break;
          }

          const foundJob = await this.runOnce();
          pollBackoffMs = this.options.pollIntervalMs;

          if (!foundJob && !signal.aborted) {
            await this.sleep(this.options.pollIntervalMs, signal);
          }
        } catch (error) {
          if (error instanceof FatalJobWorkerError) {
            throw error;
          }

          if (signal.aborted) {
            break;
          }

          this.options.logger.error(
            {
              event: 'background_job_queue_operation_failed',
              ...safeQueueError(error),
              retryInMs: pollBackoffMs,
            },
            'Background job queue operation failed',
          );
          await this.sleep(pollBackoffMs, signal);
          pollBackoffMs = Math.min(pollBackoffMs * 2, this.maxPollBackoffMs);
        }
      }
    } finally {
      this.options.logger.info(
        { event: 'background_job_worker_stopped' },
        'Background job worker stopped',
      );
    }
  }

  async runOnce() {
    const queuedJob = await this.performQueueOperation('read', () =>
      this.options.queue.readOne(this.options.visibilityTimeoutSeconds),
    );

    if (!queuedJob) {
      return false;
    }

    await this.processQueuedJob(queuedJob);
    return true;
  }

  private async processQueuedJob(queuedJob: DequeuedBackgroundJob) {
    const parsedJob = jobEnvelopeSchema.safeParse(queuedJob.message);

    if (!parsedJob.success) {
      await this.deadLetter(queuedJob, 'invalid_job_payload');
      return;
    }

    const handler = this.options.handlers.get(parsedJob.data.type);
    if (!handler) {
      await this.deadLetter(queuedJob, 'unknown_job_type', parsedJob.data.type);
      return;
    }

    if (queuedJob.readCount > this.options.maxAttempts) {
      await this.deadLetter(
        queuedJob,
        'max_attempts_exceeded',
        parsedJob.data.type,
      );
      return;
    }

    const outcome = await this.runHandlerWithLease(
      queuedJob.messageId,
      parsedJob.data,
      handler,
    );

    if (outcome.kind === 'completed') {
      await this.performQueueOperation('acknowledge', () =>
        this.options.queue.acknowledge(queuedJob.messageId),
      );
      this.options.logger.info(
        {
          event: 'background_job_completed',
          jobType: parsedJob.data.type,
          messageId: queuedJob.messageId,
          readCount: queuedJob.readCount,
        },
        'Background job completed',
      );
      return;
    }

    const errorCode =
      outcome.kind === 'timed_out'
        ? 'job_handler_timeout'
        : 'job_handler_failed';

    if (queuedJob.readCount >= this.options.maxAttempts) {
      await this.deadLetter(
        queuedJob,
        outcome.kind === 'timed_out'
          ? 'job_handler_timeout'
          : 'max_attempts_exceeded',
        parsedJob.data.type,
      );
      return;
    }

    this.options.logger.warn(
      {
        event: 'background_job_failed',
        errorCode,
        jobType: parsedJob.data.type,
        messageId: queuedJob.messageId,
        readCount: queuedJob.readCount,
      },
      'Background job failed and will be retried',
    );
  }

  private async runHandlerWithLease(
    messageId: number,
    job: JobEnvelope,
    handler: JobHandler,
  ): Promise<Exclude<HandlerOutcome, { kind: 'lease_failed' }>> {
    const handlerController = new AbortController();
    const leaseController = new AbortController();
    const timeoutController = new AbortController();
    const handlerPromise = Promise.resolve()
      .then(() => handler(job, { signal: handlerController.signal }))
      .then<HandlerOutcome, HandlerOutcome>(
        () => ({ kind: 'completed' }),
        () => ({ kind: 'failed' }),
      );
    const leasePromise = this.renewVisibility(
      messageId,
      leaseController.signal,
    ).then<HandlerOutcome, HandlerOutcome>(
      () => ({ kind: 'completed' }),
      (error: unknown) => ({ kind: 'lease_failed', error }),
    );
    const timeoutPromise = this.sleep(
      this.options.handlerTimeoutMs,
      timeoutController.signal,
    ).then<HandlerOutcome, HandlerOutcome>(
      () => ({ kind: 'timed_out' }),
      (error: unknown) => {
        if (isAbortError(error)) {
          return { kind: 'completed' };
        }

        throw error;
      },
    );

    const outcome = await Promise.race([
      handlerPromise,
      leasePromise,
      timeoutPromise,
    ]);

    leaseController.abort();
    timeoutController.abort();
    await Promise.allSettled([leasePromise, timeoutPromise]);

    if (outcome.kind === 'timed_out' || outcome.kind === 'lease_failed') {
      handlerController.abort();
      const handlerStopped = await this.waitForHandlerToStop(handlerPromise);

      if (!handlerStopped) {
        throw new FatalJobWorkerError('job_handler_did_not_stop');
      }
    }

    if (outcome.kind === 'lease_failed') {
      throw outcome.error;
    }

    return outcome;
  }

  private async renewVisibility(messageId: number, signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        await this.sleep(this.leaseRenewalIntervalMs, signal);
      } catch (error) {
        if (signal.aborted && isAbortError(error)) {
          return;
        }

        throw error;
      }

      if (signal.aborted) {
        return;
      }

      await this.performQueueOperation('extend_visibility', () =>
        this.options.queue.extendVisibility(
          messageId,
          this.options.visibilityTimeoutSeconds,
        ),
      );
    }
  }

  private async waitForHandlerToStop(handlerPromise: Promise<HandlerOutcome>) {
    const graceController = new AbortController();
    const gracePromise = this.sleep(
      this.handlerAbortGraceMs,
      graceController.signal,
    ).then(
      () => false,
      (error: unknown) => {
        if (isAbortError(error)) {
          return true;
        }

        throw error;
      },
    );
    const handlerSettledPromise = handlerPromise.then(() => true);
    const handlerStopped = await Promise.race([
      handlerSettledPromise,
      gracePromise,
    ]);

    graceController.abort();
    await Promise.allSettled([gracePromise]);
    return handlerStopped;
  }

  private async deadLetter(
    queuedJob: DequeuedBackgroundJob,
    errorCode: string,
    jobType?: string,
  ) {
    await this.performQueueOperation('dead_letter', () =>
      this.options.queue.deadLetter(queuedJob.messageId, errorCode),
    );
    this.options.logger.warn(
      {
        event: 'background_job_dead_lettered',
        errorCode,
        jobType,
        messageId: queuedJob.messageId,
        readCount: queuedJob.readCount,
      },
      'Background job moved to the dead-letter queue',
    );
  }

  private async runMaintenanceIfDue() {
    const nowMs = this.now();
    if (nowMs < this.nextMaintenanceAtMs) {
      return;
    }

    const before = new Date(
      nowMs - this.options.deadLetterRetentionMs,
    ).toISOString();
    const deletedCount = await this.performQueueOperation('maintenance', () =>
      this.options.queue.purgeDeadLetters(before, DEAD_LETTER_PURGE_LIMIT),
    );
    this.nextMaintenanceAtMs = nowMs + this.maintenanceIntervalMs;

    if (deletedCount > 0) {
      this.options.logger.info(
        {
          event: 'background_job_dead_letters_purged',
          deletedCount,
          retentionCutoff: before,
        },
        'Expired background job dead letters purged',
      );
    }
  }

  private async performQueueOperation<T>(
    operation: QueueOperation,
    action: () => Promise<T>,
  ) {
    try {
      const result = await action();
      this.queueFailureCounts.set(operation, 0);
      return result;
    } catch (error) {
      const failureCount = (this.queueFailureCounts.get(operation) ?? 0) + 1;
      this.queueFailureCounts.set(operation, failureCount);

      if (failureCount >= this.options.maxConsecutiveQueueFailures) {
        throw new FatalJobWorkerError(
          'background_job_queue_failure_threshold_exceeded',
          operation,
        );
      }

      throw error;
    }
  }
}
