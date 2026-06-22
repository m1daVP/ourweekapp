import 'dotenv/config';
import { z } from 'zod';

import { supabaseServiceRoleKeySchema } from './supabase-env.schema.js';

const positiveInteger = z.coerce.number().int().positive();

const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKeySchema,
  QUEUE_POLL_INTERVAL_MS: positiveInteger.max(60_000).default(1_000),
  QUEUE_VISIBILITY_TIMEOUT_SECONDS: positiveInteger.max(3_600).default(300),
  QUEUE_MAX_ATTEMPTS: positiveInteger.max(100).default(5),
  QUEUE_MAX_CONSECUTIVE_FAILURES: positiveInteger.max(100).default(10),
  QUEUE_HANDLER_TIMEOUT_SECONDS: positiveInteger.max(86_400).default(600),
  QUEUE_DEAD_LETTER_RETENTION_DAYS: positiveInteger.max(3_650).default(30),
});

export const workerEnv = workerEnvSchema.parse(process.env);
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
