import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'test',
      AI_PROVIDER: 'mock',
      PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
      REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
      PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
      TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
    },
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
