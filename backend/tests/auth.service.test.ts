import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const now = '2026-06-06T10:00:00.000Z';

const testEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  ARGON2_MEMORY_COST: '19456',
  ARGON2_TIME_COST: '2',
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

function createSequentialSupabase(results: unknown[]) {
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

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'rita@example.com',
    display_name: 'Rita',
    password_hash: 'hash',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function workspaceRow() {
  return {
    id: 'workspace-1',
    name: "Rita's home",
    owner_id: 'user-1',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    deleted_at: null,
  };
}

function memberRow() {
  return {
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    display_name: 'Rita',
    email: 'rita@example.com',
    role: 'owner',
    status: 'active',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
  };
}

function sessionRow() {
  return {
    id: 'session-1',
    user_id: 'user-1',
    refresh_token_hash: 'refresh-token-hash',
    device_label: null,
    created_at: '2026-06-06T10:00:00.000Z',
    expires_at: '2026-07-06T10:00:00.000Z',
    revoked_at: null,
    last_used_at: null,
  };
}

function googleIdentityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'identity-1',
    user_id: 'user-1',
    provider: 'google',
    provider_subject: 'google-subject-1',
    email: 'rita@example.com',
    email_normalized: 'rita@example.com',
    email_verified: true,
    display_name: 'Rita',
    avatar_url: 'https://example.com/avatar.png',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    ...overrides,
  };
}

function googleProvider(overrides: Record<string, unknown> = {}) {
  return {
    configured: true,
    verifyIdToken: vi.fn(async () => ({
      subject: 'google-subject-1',
      email: 'rita@example.com',
      displayName: 'Rita',
      avatarUrl: 'https://example.com/avatar.png',
      ...overrides,
    })),
  };
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('creates a user, workspace, Google identity, and session for a new Google identity', async () => {
    const { authService } = await loadAuthModules();
    const provider = googleProvider();
    const supabase = createSequentialSupabase([
      { data: null, error: null },
      { data: null, error: null },
      { data: userRow({ password_hash: null }), error: null },
      { data: googleIdentityRow(), error: null },
      { data: workspaceRow(), error: null },
      { data: memberRow(), error: null },
      { data: sessionRow(), error: null },
    ]);

    const response = await authService.signInWithGoogle(
      supabase,
      { idToken: 'google-id-token' },
      provider,
    );

    expect(response.user).toMatchObject({
      id: 'user-1',
      workspaceId: 'workspace-1',
      email: 'rita@example.com',
      displayName: 'Rita',
      role: 'owner',
      planType: 'free',
    });
    expect(response.accessToken).toEqual(expect.any(String));
    expect(response.refreshToken).toEqual(expect.any(String));
  });

  it('signs in through an existing Google identity', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: googleIdentityRow(), error: null },
      { data: userRow({ password_hash: null }), error: null },
      { data: [memberRow()], error: null },
      { data: sessionRow(), error: null },
    ]);

    const response = await authService.signInWithGoogle(
      supabase,
      { idToken: 'google-id-token' },
      googleProvider(),
    );

    expect(response.user.id).toBe('user-1');
    expect(response.user.workspaceId).toBe('workspace-1');
  });

  it('links a verified Google identity to an existing password account by email', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: null, error: null },
      { data: userRow(), error: null },
      { data: googleIdentityRow(), error: null },
      { data: [memberRow()], error: null },
      { data: sessionRow(), error: null },
    ]);

    const response = await authService.signInWithGoogle(
      supabase,
      { idToken: 'google-id-token' },
      googleProvider(),
    );

    expect(response.user.email).toBe('rita@example.com');
    expect(response.user.workspaceId).toBe('workspace-1');
  });

  it('rejects invalid Google tokens before touching account data', async () => {
    const { authService } = await loadAuthModules();
    const { ApiError } = await import('../src/shared/errors/index.js');
    const provider = {
      configured: true,
      verifyIdToken: vi.fn(async () => {
        throw new ApiError(
          401,
          'invalid_google_token',
          'Google sign-in could not be verified.',
        );
      }),
    };
    const supabase = createSequentialSupabase([]);

    await expect(
      authService.signInWithGoogle(
        supabase,
        { idToken: 'google-id-token' },
        provider,
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_google_token',
    });
  });

  it('rejects Google identities linked to deleted users', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: googleIdentityRow(), error: null },
      { data: null, error: null },
    ]);

    await expect(
      authService.signInWithGoogle(
        supabase,
        { idToken: 'google-id-token' },
        googleProvider(),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_google_token',
    });
  });

  it('rejects password sign-in for Google-only accounts with the generic credentials error', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: userRow({ password_hash: null }), error: null },
    ]);

    await expect(
      authService.signInUser(supabase, {
        email: 'rita@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_credentials',
    });
  });
});
