import 'dotenv/config';
import { z } from 'zod';

import { supabaseServiceRoleKeySchema } from './supabase-env.schema.js';

const integerFromString = z.coerce.number().int().positive();
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));
const optionalUrl = optionalString.pipe(z.string().url().optional());
const optionalPort = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().min(1).max(65535).optional(),
);
const csvList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const envInput = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    APP_ENV: z
      .enum(['local', 'development', 'staging', 'production', 'test'])
      .default('local'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    PUBLIC_API_BASE_URL: z.string().url(),
    CORS_ORIGINS: csvList,
    CORS_ALLOWED_ORIGINS: csvList,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SENTRY_DSN: optionalUrl,

    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKeySchema,
    SUPABASE_ANON_KEY: z.string().min(1),

    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    PASSWORD_RESET_TOKEN_SECRET: z.string().min(32),
    TOKEN_ENCRYPTION_KEY: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: integerFromString.default(900),
    REFRESH_TOKEN_TTL_DAYS: integerFromString.default(30),

    ARGON2_MEMORY_COST: integerFromString.default(65536),
    ARGON2_TIME_COST: integerFromString.default(3),
    ARGON2_PARALLELISM: integerFromString.default(1),

    AI_PROVIDER: optionalString.pipe(z.enum(['openai']).optional()),
    AI_API_KEY: optionalString,
    AI_MODEL: optionalString,
    OPENAI_API_KEY: optionalString,

    REVENUECAT_PROJECT_ID: optionalString,
    REVENUECAT_API_KEY: optionalString,
    REVENUECAT_ENTITLEMENT_ID: optionalString,
    REVENUECAT_WEBHOOK_SHARED_SECRET: optionalString,
    GOOGLE_PLAY_PACKAGE_NAME: optionalString,
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64: optionalString,

    GOOGLE_OAUTH_CLIENT_ID: optionalString,
    GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
    GOOGLE_OAUTH_REDIRECT_URL: optionalUrl,
    GOOGLE_OAUTH_REDIRECT_URI: optionalUrl,

    SMTP_HOST: optionalString,
    SMTP_PORT: optionalPort,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,
  })
  .superRefine((value, context) => {
    const aiApiKey = value.AI_API_KEY ?? value.OPENAI_API_KEY;
    const corsOrigins =
      value.CORS_ALLOWED_ORIGINS.length > 0
        ? value.CORS_ALLOWED_ORIGINS
        : value.CORS_ORIGINS;

    if (value.AI_PROVIDER && !aiApiKey) {
      context.addIssue({
        code: 'custom',
        path: ['AI_API_KEY'],
        message: 'AI_API_KEY is required when AI_PROVIDER is configured',
      });
    }

    if (
      (value.NODE_ENV === 'production' || value.APP_ENV === 'production') &&
      corsOrigins.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'CORS_ALLOWED_ORIGINS must list trusted origins in production',
      });
    }

    const smtpFields = [
      value.SMTP_HOST,
      value.SMTP_PORT,
      value.SMTP_USER,
      value.SMTP_PASSWORD,
      value.EMAIL_FROM,
    ];
    const smtpTouched = smtpFields.some(Boolean);

    if (!smtpTouched) {
      return;
    }

    const requiredSmtpFields = [
      ['SMTP_HOST', value.SMTP_HOST],
      ['SMTP_PORT', value.SMTP_PORT],
      ['SMTP_USER', value.SMTP_USER],
      ['SMTP_PASSWORD', value.SMTP_PASSWORD],
      ['EMAIL_FROM', value.EMAIL_FROM],
    ] as const;

    for (const [field, fieldValue] of requiredSmtpFields) {
      if (fieldValue === undefined) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required when SMTP is configured`,
        });
      }
    }
  });

const envSchema = envInput.transform((value) => {
  const aiApiKey = value.AI_API_KEY ?? value.OPENAI_API_KEY ?? '';
  const aiProvider = value.AI_PROVIDER ?? (aiApiKey ? 'openai' : undefined);
  const googleOAuthRedirectUri =
    value.GOOGLE_OAUTH_REDIRECT_URL ?? value.GOOGLE_OAUTH_REDIRECT_URI ?? '';
  const corsOrigins =
    value.CORS_ALLOWED_ORIGINS.length > 0
      ? value.CORS_ALLOWED_ORIGINS
      : value.CORS_ORIGINS;

  return {
    ...value,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOWED_ORIGINS: corsOrigins,
    AI_API_KEY: aiApiKey,
    OPENAI_API_KEY: aiApiKey,
    AI_PROVIDER: aiProvider,
    AI_CONFIGURED: aiProvider === 'openai' && aiApiKey.length > 0,
    REVENUECAT_PROJECT_ID: value.REVENUECAT_PROJECT_ID ?? '',
    REVENUECAT_API_KEY: value.REVENUECAT_API_KEY ?? '',
    REVENUECAT_ENTITLEMENT_ID: value.REVENUECAT_ENTITLEMENT_ID ?? 'premium',
    REVENUECAT_WEBHOOK_SHARED_SECRET:
      value.REVENUECAT_WEBHOOK_SHARED_SECRET ?? '',
    REVENUECAT_CONFIGURED: Boolean(value.REVENUECAT_API_KEY),
    GOOGLE_OAUTH_CLIENT_ID: value.GOOGLE_OAUTH_CLIENT_ID ?? '',
    GOOGLE_OAUTH_CLIENT_SECRET: value.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    GOOGLE_OAUTH_REDIRECT_URI: googleOAuthRedirectUri,
    GOOGLE_OAUTH_REDIRECT_URL: googleOAuthRedirectUri,
    GOOGLE_OAUTH_CONFIGURED: Boolean(
      value.GOOGLE_OAUTH_CLIENT_ID &&
        value.GOOGLE_OAUTH_CLIENT_SECRET &&
        googleOAuthRedirectUri,
    ),
    SMTP_CONFIGURED: Boolean(
      value.SMTP_HOST &&
        value.SMTP_PORT &&
        value.SMTP_USER &&
        value.SMTP_PASSWORD &&
        value.EMAIL_FROM,
    ),
  };
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
