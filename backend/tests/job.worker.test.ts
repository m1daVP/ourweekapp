import { setTimeout as wait } from 'node:timers/promises';

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/shared/errors/index.js';
import type { DequeuedBackgroundJob } from '../src/shared/jobs/job.queue.js';
import {
  FatalJobWorkerError,
  JobWorker,
  type BackgroundJobQueuePort,
  type JobHandler,
  type JobWorkerLogger,
} from '../src/shared/jobs/job.worker.js';

const envelope = {
  type: 'test.job',
  version: 1 as const,
  idempotencyKey: 'job-1',
  payload: { recordId: 'record-1' },
};

function queuedJob(overrides: Partial<DequeuedBackgroundJob> = {}): DequeuedBackgroundJob {
  return {
    messageId: 11,
    readCount: 1,
    enqueuedAt: '2026-06-19T12:00:00.000Z',
    visibleAt: '2026-06-19T12:05:00.000Z',
    message: envelope,
    ...overrides,
  };
}

function createQueue(message: DequeuedBackgroundJob | null) {
  return {
    readOne: vi.fn().mockResolvedValue(message),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    extendVisibility: vi.fn().mockResolvedValue(undefined),
    deadLetter: vi.fn().mockResolvedValue(undefined),
    purgeDeadLetters: vi.fn().mockResolvedValue(0),
  } satisfies BackgroundJobQueuePort;
}

function createLogger(): JobWorkerLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createWorker(
  queue: BackgroundJobQueuePort,
  handlers: ReadonlyMap<string, JobHandler>,
  overrides: Partial<ConstructorParameters<typeof JobWorker>[0]> = {},
) {
  return new JobWorker({
    queue,
    handlers,
    logger: createLogger(),
    pollIntervalMs: 100,
    visibilityTimeoutSeconds: 300,
    maxAttempts: 3,
    maxConsecutiveQueueFailures: 3,
    handlerTimeoutMs: 1_000,
    deadLetterRetentionMs: 30 * 24 * 60 * 60 * 1_000,
    ...overrides,
  });
}

function abortAwareHandler() {
  return vi.fn(
    (_job, context) =>
      new Promise<void>((_resolve, reject) => {
        context.signal.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
      }),
  );
}

describe('JobWorker', () => {
  it('acknowledges a job only after its handler succeeds', async () => {
    const queue = createQueue(queuedJob());
    const handler = vi.fn().mockResolvedValue(undefined);
    const worker = createWorker(queue, new Map([['test.job', handler]]));

    await expect(worker.runOnce()).resolves.toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toEqual(envelope);
    expect(handler.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
    expect(queue.acknowledge).toHaveBeenCalledWith(11);
    expect(queue.deadLetter).not.toHaveBeenCalled();
  });

  it('leaves a failed job unacknowledged before its attempt limit', async () => {
    const queue = createQueue(queuedJob({ readCount: 2 }));
    const handler = vi.fn().mockRejectedValue(new Error('private failure'));
    const worker = createWorker(queue, new Map([['test.job', handler]]));

    await worker.runOnce();
    expect(queue.acknowledge).not.toHaveBeenCalled();
    expect(queue.deadLetter).not.toHaveBeenCalled();
  });

  it('does not count business-handler failures as queue failures', async () => {
    const queue = createQueue(queuedJob());
    const handler = vi.fn().mockRejectedValue(new Error('private failure'));
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      maxConsecutiveQueueFailures: 1,
    });

    await expect(
      Promise.all([worker.runOnce(), worker.runOnce(), worker.runOnce()]),
    ).resolves.toEqual([true, true, true]);
  });

  it('dead-letters a failed job at its attempt limit', async () => {
    const queue = createQueue(queuedJob({ readCount: 3 }));
    const handler = vi.fn().mockRejectedValue(new Error('private failure'));
    const worker = createWorker(queue, new Map([['test.job', handler]]));

    await worker.runOnce();
    expect(queue.deadLetter).toHaveBeenCalledWith(11, 'max_attempts_exceeded');
    expect(queue.acknowledge).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_job_payload', { invalid: true }],
    ['unknown_job_type', { ...envelope, type: 'missing.job' }],
  ])('dead-letters jobs with %s', async (errorCode, message) => {
    const queue = createQueue(queuedJob({ message }));
    const worker = createWorker(queue, new Map());

    await worker.runOnce();
    expect(queue.deadLetter).toHaveBeenCalledWith(11, errorCode);
  });

  it('renews visibility while a handler is active', async () => {
    const queue = createQueue(queuedJob());
    const handler = vi.fn(async () => {
      await wait(35);
    });
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      leaseRenewalIntervalMs: 5,
    });

    await worker.runOnce();
    expect(queue.extendVisibility).toHaveBeenCalled();
    expect(queue.acknowledge).toHaveBeenCalledWith(11);
  });

  it('aborts the handler and leaves the job unacknowledged when lease renewal fails', async () => {
    const queue = createQueue(queuedJob());
    const queueError = new ApiError(
      500,
      'background_job_visibility_extend_failed',
      'Safe failure',
    );
    queue.extendVisibility.mockRejectedValue(queueError);
    const handler = abortAwareHandler();
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      leaseRenewalIntervalMs: 5,
      handlerAbortGraceMs: 50,
    });

    await expect(worker.runOnce()).rejects.toBe(queueError);
    expect(handler.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(queue.acknowledge).not.toHaveBeenCalled();
  });

  it('aborts a handler that reaches its runtime timeout', async () => {
    const queue = createQueue(queuedJob());
    const handler = abortAwareHandler();
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      handlerTimeoutMs: 5,
      handlerAbortGraceMs: 50,
      leaseRenewalIntervalMs: 1_000,
    });

    await worker.runOnce();
    expect(handler.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(queue.acknowledge).not.toHaveBeenCalled();
    expect(queue.deadLetter).not.toHaveBeenCalled();
  });

  it('dead-letters a timed-out handler at its attempt limit', async () => {
    const queue = createQueue(queuedJob({ readCount: 3 }));
    const handler = abortAwareHandler();
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      handlerTimeoutMs: 5,
      handlerAbortGraceMs: 50,
      leaseRenewalIntervalMs: 1_000,
    });

    await worker.runOnce();
    expect(queue.deadLetter).toHaveBeenCalledWith(11, 'job_handler_timeout');
  });

  it('fails fatally when a timed-out handler ignores cancellation', async () => {
    const queue = createQueue(queuedJob());
    const handler = vi.fn(() => new Promise<void>(() => undefined));
    const worker = createWorker(queue, new Map([['test.job', handler]]), {
      handlerTimeoutMs: 5,
      handlerAbortGraceMs: 5,
      leaseRenewalIntervalMs: 1_000,
    });

    await expect(worker.runOnce()).rejects.toMatchObject({
      code: 'job_handler_did_not_stop',
    });
  });

  it('backs off repeated queue read failures', async () => {
    const queue = createQueue(null);
    queue.readOne.mockRejectedValue(
      new ApiError(500, 'background_job_queue_read_failed', 'Safe failure'),
    );
    const controller = new AbortController();
    const delays: number[] = [];
    const sleep = vi.fn(async (delayMs: number) => {
      delays.push(delayMs);
      if (delays.length === 2) {
        controller.abort();
      }
    });
    const worker = createWorker(queue, new Map(), {
      sleep,
      maxPollBackoffMs: 1_000,
    });

    await worker.run(controller.signal);
    expect(delays).toEqual([100, 200]);
  });

  it('fails fatally after the queue failure threshold', async () => {
    const queue = createQueue(null);
    queue.readOne.mockRejectedValue(
      new ApiError(500, 'background_job_queue_read_failed', 'Safe failure'),
    );
    const worker = createWorker(queue, new Map(), {
      maxConsecutiveQueueFailures: 2,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(worker.run(new AbortController().signal)).rejects.toMatchObject({
      code: 'background_job_queue_failure_threshold_exceeded',
      operation: 'read',
    });
  });

  it('resets a queue operation failure count after that operation succeeds', async () => {
    const queue = createQueue(null);
    const queueError = new ApiError(
      500,
      'background_job_queue_read_failed',
      'Safe failure',
    );
    queue.readOne
      .mockRejectedValueOnce(queueError)
      .mockResolvedValueOnce(null)
      .mockRejectedValue(queueError);
    const controller = new AbortController();
    let sleepCount = 0;
    const worker = createWorker(queue, new Map(), {
      maxConsecutiveQueueFailures: 2,
      sleep: vi.fn(async () => {
        sleepCount += 1;
        if (sleepCount === 3) {
          controller.abort();
        }
      }),
    });

    await expect(worker.run(controller.signal)).resolves.toBeUndefined();
    expect(queue.readOne).toHaveBeenCalledTimes(3);
  });

  it('purges expired dead letters when the worker starts', async () => {
    const queue = createQueue(null);
    const controller = new AbortController();
    queue.purgeDeadLetters.mockImplementation(async () => {
      controller.abort();
      return 2;
    });
    const now = Date.parse('2026-06-22T12:00:00.000Z');
    const worker = createWorker(queue, new Map(), { now: () => now });

    await worker.run(controller.signal);
    expect(queue.purgeDeadLetters).toHaveBeenCalledWith(
      '2026-05-23T12:00:00.000Z',
      500,
    );
    expect(queue.readOne).not.toHaveBeenCalled();
  });

  it('finishes the active handler before stopping', async () => {
    const queue = createQueue(queuedJob());
    let resolveHandler: (() => void) | undefined;
    let notifyStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
          notifyStarted?.();
        }),
    );
    const controller = new AbortController();
    const worker = createWorker(queue, new Map([['test.job', handler]]));

    const running = worker.run(controller.signal);
    await started;
    controller.abort();
    resolveHandler?.();
    await running;

    expect(queue.acknowledge).toHaveBeenCalledWith(11);
    expect(queue.readOne).toHaveBeenCalledTimes(1);
  });
});
