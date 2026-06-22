import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { BackgroundJobQueue } from '../src/shared/jobs/job.queue.js';
import type { SupabaseRepositoryClient } from '../src/shared/repositories/index.js';

function createSupabaseMock(result: { data: unknown; error: PostgrestError | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    client: { rpc } as unknown as SupabaseRepositoryClient,
    rpc,
  };
}

const job = {
  type: 'test.job',
  version: 1 as const,
  idempotencyKey: 'job-1',
  payload: { recordId: 'record-1' },
};

describe('BackgroundJobQueue', () => {
  it('enqueues a validated job through the fixed RPC', async () => {
    const { client, rpc } = createSupabaseMock({ data: 42, error: null });
    const queue = new BackgroundJobQueue(client);

    await expect(queue.enqueue(job, 10)).resolves.toBe(42);
    expect(rpc).toHaveBeenCalledWith('enqueue_background_job', {
      p_job: job,
      p_delay_seconds: 10,
    });
  });

  it('maps one queue record into the worker shape', async () => {
    const { client } = createSupabaseMock({
      data: [
        {
          msg_id: 7,
          read_ct: 2,
          enqueued_at: '2026-06-19T12:00:00.000Z',
          vt: '2026-06-19T12:05:00.000Z',
          message: job,
        },
      ],
      error: null,
    });
    const queue = new BackgroundJobQueue(client);

    await expect(queue.readOne(300)).resolves.toEqual({
      messageId: 7,
      readCount: 2,
      enqueuedAt: '2026-06-19T12:00:00.000Z',
      visibleAt: '2026-06-19T12:05:00.000Z',
      message: job,
    });
  });

  it('maps database failures to a stable application error', async () => {
    const { client } = createSupabaseMock({
      data: null,
      error: {
        code: 'XX000',
        details: 'private database details',
        hint: 'private database hint',
        message: 'private database message',
        name: 'PostgrestError',
      },
    });
    const queue = new BackgroundJobQueue(client);

    await expect(queue.readOne(300)).rejects.toMatchObject({
      code: 'background_job_queue_read_failed',
      message: 'Unable to read background jobs.',
      details: { databaseCode: 'XX000' },
    });
  });

  it('requires acknowledgement RPCs to confirm deletion', async () => {
    const { client } = createSupabaseMock({ data: false, error: null });
    const queue = new BackgroundJobQueue(client);

    await expect(queue.acknowledge(7)).rejects.toMatchObject({
      code: 'background_job_acknowledge_failed',
    });
  });

  it('extends visibility through the fixed RPC', async () => {
    const { client, rpc } = createSupabaseMock({ data: true, error: null });
    const queue = new BackgroundJobQueue(client);

    await queue.extendVisibility(7, 300);
    expect(rpc).toHaveBeenCalledWith(
      'extend_background_job_visibility',
      {
        p_msg_id: 7,
        p_visibility_timeout_seconds: 300,
      },
    );
  });

  it('returns the number of expired dead letters purged', async () => {
    const { client, rpc } = createSupabaseMock({ data: 12, error: null });
    const queue = new BackgroundJobQueue(client);

    await expect(
      queue.purgeDeadLetters('2026-05-23T12:00:00.000Z', 500),
    ).resolves.toBe(12);
    expect(rpc).toHaveBeenCalledWith(
      'purge_background_job_dead_letters',
      {
        p_before: '2026-05-23T12:00:00.000Z',
        p_limit: 500,
      },
    );
  });
});
