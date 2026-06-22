import { z } from 'zod';

import { ApiError } from '../errors/index.js';
import type { SupabaseRepositoryClient } from '../repositories/index.js';
import { throwOnSupabaseError } from '../repositories/index.js';
import { jobEnvelopeSchema, type JobEnvelope } from './job.schema.js';

const queueMessageIdSchema = z.coerce.number().int().positive().safe();
const queueRecordSchema = z.object({
  msg_id: queueMessageIdSchema,
  read_ct: z.coerce.number().int().positive().safe(),
  enqueued_at: z.string().datetime({ offset: true }),
  vt: z.string().datetime({ offset: true }),
  message: z.unknown(),
});

const queueRecordsSchema = z.array(queueRecordSchema).max(1);
const enqueueDelaySchema = z.number().int().min(0).max(86_400);
const visibilityTimeoutSchema = z.number().int().min(1).max(3_600);
const purgeBeforeSchema = z.string().datetime({ offset: true });
const purgeLimitSchema = z.number().int().min(1).max(1_000);
const deletedCountSchema = z.coerce.number().int().nonnegative().safe();

export type DequeuedBackgroundJob = {
  messageId: number;
  readCount: number;
  enqueuedAt: string;
  visibleAt: string;
  message: unknown;
};

function parseQueueRecords(value: unknown) {
  const parsed = queueRecordsSchema.safeParse(value ?? []);

  if (!parsed.success) {
    throw new ApiError(
      500,
      'background_job_queue_response_invalid',
      'The background job queue returned an invalid response.',
    );
  }

  return parsed.data;
}

function requireSuccessfulMutation(
  result: unknown,
  code: string,
  message: string,
) {
  if (result !== true) {
    throw new ApiError(500, code, message);
  }
}

export class BackgroundJobQueue {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async enqueue(job: JobEnvelope, delaySeconds = 0) {
    const parsedJob = jobEnvelopeSchema.parse(job);
    const parsedDelay = enqueueDelaySchema.parse(delaySeconds);
    const { data, error } = await this.supabase.rpc('enqueue_background_job', {
      p_job: parsedJob,
      p_delay_seconds: parsedDelay,
    });

    throwOnSupabaseError(
      error,
      'background_job_enqueue_failed',
      'Unable to enqueue the background job.',
    );

    const parsedMessageId = queueMessageIdSchema.safeParse(data);
    if (!parsedMessageId.success) {
      throw new ApiError(
        500,
        'background_job_enqueue_failed',
        'Unable to enqueue the background job.',
      );
    }

    return parsedMessageId.data;
  }

  async readOne(visibilityTimeoutSeconds: number): Promise<DequeuedBackgroundJob | null> {
    const parsedVisibilityTimeout = visibilityTimeoutSchema.parse(
      visibilityTimeoutSeconds,
    );
    const { data, error } = await this.supabase.rpc('read_background_jobs', {
      p_visibility_timeout_seconds: parsedVisibilityTimeout,
      p_batch_size: 1,
    });

    throwOnSupabaseError(
      error,
      'background_job_queue_read_failed',
      'Unable to read background jobs.',
    );

    const record = parseQueueRecords(data)[0];
    if (!record) {
      return null;
    }

    return {
      messageId: record.msg_id,
      readCount: record.read_ct,
      enqueuedAt: record.enqueued_at,
      visibleAt: record.vt,
      message: record.message,
    };
  }

  async acknowledge(messageId: number) {
    const parsedMessageId = queueMessageIdSchema.parse(messageId);
    const { data, error } = await this.supabase.rpc('delete_background_job', {
      p_msg_id: parsedMessageId,
    });

    throwOnSupabaseError(
      error,
      'background_job_acknowledge_failed',
      'Unable to acknowledge the background job.',
    );
    requireSuccessfulMutation(
      data,
      'background_job_acknowledge_failed',
      'Unable to acknowledge the background job.',
    );
  }

  async extendVisibility(messageId: number, visibilityTimeoutSeconds: number) {
    const parsedMessageId = queueMessageIdSchema.parse(messageId);
    const parsedVisibilityTimeout = visibilityTimeoutSchema.parse(
      visibilityTimeoutSeconds,
    );
    const { data, error } = await this.supabase.rpc(
      'extend_background_job_visibility',
      {
        p_msg_id: parsedMessageId,
        p_visibility_timeout_seconds: parsedVisibilityTimeout,
      },
    );

    throwOnSupabaseError(
      error,
      'background_job_visibility_extend_failed',
      'Unable to extend background job visibility.',
    );
    requireSuccessfulMutation(
      data,
      'background_job_visibility_extend_failed',
      'Unable to extend background job visibility.',
    );
  }

  async deadLetter(messageId: number, errorCode: string) {
    const parsedMessageId = queueMessageIdSchema.parse(messageId);
    const { data, error } = await this.supabase.rpc(
      'dead_letter_background_job',
      {
        p_msg_id: parsedMessageId,
        p_error_code: errorCode,
      },
    );

    throwOnSupabaseError(
      error,
      'background_job_dead_letter_failed',
      'Unable to dead-letter the background job.',
    );
    requireSuccessfulMutation(
      data,
      'background_job_dead_letter_failed',
      'Unable to dead-letter the background job.',
    );
  }

  async purgeDeadLetters(before: string, limit = 500) {
    const parsedBefore = purgeBeforeSchema.parse(before);
    const parsedLimit = purgeLimitSchema.parse(limit);
    const { data, error } = await this.supabase.rpc(
      'purge_background_job_dead_letters',
      {
        p_before: parsedBefore,
        p_limit: parsedLimit,
      },
    );

    throwOnSupabaseError(
      error,
      'background_job_dead_letter_purge_failed',
      'Unable to purge expired background job dead letters.',
    );

    const parsedDeletedCount = deletedCountSchema.safeParse(data);
    if (!parsedDeletedCount.success) {
      throw new ApiError(
        500,
        'background_job_dead_letter_purge_failed',
        'Unable to purge expired background job dead letters.',
      );
    }

    return parsedDeletedCount.data;
  }
}
