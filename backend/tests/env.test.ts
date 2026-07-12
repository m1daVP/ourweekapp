import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const baseEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
};

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    ...baseEnv,
    AI_PROVIDER: '',
    AI_API_KEY: '',
    ...overrides,
  };

  return import('../src/config/env.js');
}

describe('env AI provider configuration', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('allows the mock AI provider without an API key', async () => {
    const { env } = await loadEnv({ AI_PROVIDER: 'mock' });

    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.AI_CONFIGURED).toBe(true);
    expect(env.AI_API_KEY).toBe('');
  });

  it('requires an API key for the OpenAI provider', async () => {
    await expect(loadEnv({ AI_PROVIDER: 'openai' })).rejects.toThrow(
      'AI_API_KEY is required when AI_PROVIDER is configured',
    );
  });

  it('rejects the mock AI provider in production', async () => {
    await expect(
      loadEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://example.com',
        AI_PROVIDER: 'mock',
      }),
    ).rejects.toThrow('AI_PROVIDER=mock is not allowed in production');
  });

  it('derives Google Sign-In configuration from the client ID allow-list', async () => {
    const { env } = await loadEnv({
      GOOGLE_SIGN_IN_CLIENT_IDS: 'android-client-id, ios-client-id',
    });

    expect(env.GOOGLE_SIGN_IN_CLIENT_IDS).toEqual([
      'android-client-id',
      'ios-client-id',
    ]);
    expect(env.GOOGLE_SIGN_IN_CONFIGURED).toBe(true);
    expect(env.GOOGLE_OAUTH_CONFIGURED).toBe(false);
  });

  it('requires SMTP configuration in production', async () => {
    await expect(
      loadEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://example.com',
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        EMAIL_FROM: '',
      }),
    ).rejects.toThrow('required in production');
  });

  it('allows a fully configured SMTP setup in production', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'smtp-password',
      EMAIL_FROM: 'OurWeek <no-reply@example.com>',
    });

    expect(env.SMTP_CONFIGURED).toBe(true);
  });
});
