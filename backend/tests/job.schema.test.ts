import { describe, expect, it } from 'vitest';

import {
  JOB_ENVELOPE_MAX_BYTES,
  jobEnvelopeSchema,
} from '../src/shared/jobs/job.schema.js';

describe('jobEnvelopeSchema', () => {
  it('accepts a versioned envelope with JSON payload data', () => {
    const result = jobEnvelopeSchema.parse({
      type: 'ai.summary.generate',
      version: 1,
      idempotencyKey: 'request-id',
      payload: {
        requestId: 'request-id',
        options: ['one', 2, true, null],
      },
    });

    expect(result.type).toBe('ai.summary.generate');
    expect(result.version).toBe(1);
  });

  it.each([
    { type: 'Invalid Type', version: 1, idempotencyKey: 'id', payload: {} },
    { type: 'valid.type', version: 2, idempotencyKey: 'id', payload: {} },
    { type: 'valid.type', version: 1, idempotencyKey: '', payload: {} },
    {
      type: 'valid.type',
      version: 1,
      idempotencyKey: 'id',
      payload: {},
      unexpected: true,
    },
  ])('rejects malformed envelopes', (envelope) => {
    expect(jobEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it('rejects envelopes larger than the queue size limit', () => {
    const result = jobEnvelopeSchema.safeParse({
      type: 'test.job',
      version: 1,
      idempotencyKey: 'job-1',
      payload: { value: 'x'.repeat(JOB_ENVELOPE_MAX_BYTES) },
    });

    expect(result.success).toBe(false);
  });
});
