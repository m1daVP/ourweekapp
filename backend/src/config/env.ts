import 'dotenv/config';
import { z } from 'zod';

const integerFromString = z.coerce.number().int().positive();
const csvList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: csvList,

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: integerFromString.default(900),
  REFRESH_TOKEN_TTL_DAYS: integerFromString.default(30),

  ARGON2_MEMORY_COST: integerFromString.default(65536),
  ARGON2_TIME_COST: integerFromString.default(3),
  ARGON2_PARALLELISM: integerFromString.default(1),

  OPENAI_API_KEY: z.string().min(1),

  REVENUECAT_PROJECT_ID: z.string().min(1),
  REVENUECAT_API_KEY: z.string().min(1),
  REVENUECAT_WEBHOOK_SHARED_SECRET: z.string().min(1),

  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
