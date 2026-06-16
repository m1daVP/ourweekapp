import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const testEnv = {
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
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
};

async function loadAuthModules() {
  vi.resetModules();
  Object.assign(process.env, testEnv);

  const [authService, tokenService] = await Promise.all([
    import('../src/modules/auth/auth.service.js'),
    import('../src/modules/auth/token.service.js'),
  ]);

  return { authService, tokenService };
}

function createQuery(result: unknown) {
  const query = {
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    insert: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    returns: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
    update: vi.fn(() => query),
  };

  return query;
}

function createRefreshRaceSupabase(refreshTokenHash: string) {
  const session = {
    id: 'session-1',
    user_id: 'user-1',
    refresh_token_hash: refreshTokenHash,
    device_label: null,
    created_at: '2026-06-06T10:00:00.000Z',
    expires_at: '2026-07-06T10:00:00.000Z',
    revoked_at: null,
    last_used_at: null,
  };
  const user = {
    id: 'user-1',
    email: 'rita@example.com',
    display_name: 'Rita',
    password_hash: 'hash',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    deleted_at: null,
  };
  const member = {
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    display_name: 'Rita',
    email: 'rita@example.com',
    role: 'owner',
    status: 'active',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
  };

  const results = [
    { data: session, error: null },
    { data: user, error: null },
    { data: [member], error: null },
    { data: null, error: null },
  ];

  return {
    from: vi.fn(() => {
      const result = results.shift();

      if (!result) {
        throw new Error('Unexpected Supabase call');
      }

      return createQuery(result);
    }),
  } as unknown as SupabaseClient;
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects /auth/me when repository-backed auth context is revoked', async () => {
    const { authService, tokenService } = await loadAuthModules();
    const accessToken = await tokenService.issueAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      role: 'owner',
    });
    const repository = {
      getAuthenticatedContext: vi.fn(async () => null),
    };

    await expect(
      authService.getCurrentUser(
        {} as SupabaseClient,
        `Bearer ${accessToken}`,
        repository,
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_session',
    });
    expect(repository.getAuthenticatedContext).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        role: 'owner',
      }),
    );
  });

  it('treats refresh rotation no-row updates as invalid sessions', async () => {
    const { authService, tokenService } = await loadAuthModules();
    const refreshSession = tokenService.issueRefreshTokenSession(
      new Date('2026-06-06T10:00:00.000Z'),
    );
    const supabase = createRefreshRaceSupabase(
      refreshSession.refreshTokenHash,
    );

    await expect(
      authService.refreshSession(supabase, {
        refreshToken: refreshSession.refreshToken,
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_session',
    });
  });

  it('returns an explicit safe error for password reset confirm while reset storage is unavailable', async () => {
    const { authService } = await loadAuthModules();

    await expect(
      authService.confirmPasswordReset({} as SupabaseClient, {
        token: 'reset-token-that-is-long-enough',
        password: 'new-strong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'password_reset_not_configured',
    });
  });
});
