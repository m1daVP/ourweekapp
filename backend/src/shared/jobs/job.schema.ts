import { Buffer } from 'node:buffer';

import { z } from 'zod';

import type { JsonValue } from '../repositories/index.js';

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const JOB_ENVELOPE_MAX_BYTES = 16 * 1024;

export const jobEnvelopeSchema = z
  .object({
    type: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_.-]*$/),
    version: z.literal(1),
    idempotencyKey: z.string().trim().min(1).max(200),
    payload: jsonValueSchema,
  })
  .strict()
  .superRefine((job, context) => {
    const serializedBytes = Buffer.byteLength(JSON.stringify(job), 'utf8');

    if (serializedBytes > JOB_ENVELOPE_MAX_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `Job envelope must not exceed ${JOB_ENVELOPE_MAX_BYTES} bytes`,
      });
    }
  });

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
