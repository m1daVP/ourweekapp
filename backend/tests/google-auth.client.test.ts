import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const verifyIdToken = vi.hoisted(() => vi.fn());

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function OAuth2() {
        return { verifyIdToken };
      }),
    },
  },
}));

const baseEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
};

async function loadGoogleAuthClient(
  overrides: Record<string, string | undefined> = {},
) {
  vi.resetModules();
  verifyIdToken.mockReset();
  process.env = {
    ...originalEnv,
    ...baseEnv,
    GOOGLE_SIGN_IN_CLIENT_IDS: 'android-client-id,ios-client-id',
    ...overrides,
  };

  return import('../src/modules/auth/google-auth.client.js');
}

describe('googleAuthProvider', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('verifies ID tokens against the configured client ID allow-list', async () => {
    const { googleAuthProvider } = await loadGoogleAuthClient();
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-subject-1',
        email: 'rita@example.com',
        email_verified: true,
        name: 'Rita',
        picture: 'https://example.com/avatar.png',
      }),
    });

    const identity = await googleAuthProvider.verifyIdToken('id-token');

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: ['android-client-id', 'ios-client-id'],
    });
    expect(identity).toEqual({
      subject: 'google-subject-1',
      email: 'rita@example.com',
      displayName: 'Rita',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('rejects Google ID tokens without a verified email', async () => {
    const { googleAuthProvider } = await loadGoogleAuthClient();
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-subject-1',
        email: 'rita@example.com',
        email_verified: false,
      }),
    });

    await expect(
      googleAuthProvider.verifyIdToken('id-token'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_google_token',
    });
  });

  it('fails safely when Google Sign-In is not configured', async () => {
    const { googleAuthProvider } = await loadGoogleAuthClient({
      GOOGLE_SIGN_IN_CLIENT_IDS: '',
    });

    await expect(
      googleAuthProvider.verifyIdToken('id-token'),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'google_sign_in_not_configured',
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
