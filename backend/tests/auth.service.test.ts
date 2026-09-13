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

type SupabaseOperation = {
  table: string;
  action: 'from' | 'insert' | 'rpc';
  payload?: unknown;
};

function createQuery(
  result: unknown,
  table = '',
  operations: SupabaseOperation[] = [],
) {
  const query = {
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    insert: vi.fn((payload: unknown) => {
      operations.push({ table, action: 'insert', payload });
      return query;
    }),
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

function createSequentialSupabase(
  results: unknown[],
  operations: SupabaseOperation[] = [],
) {
  return {
    from: vi.fn((table: string) => {
      operations.push({ table, action: 'from' });
      const result = results.shift();

      if (!result) {
        throw new Error('Unexpected Supabase call');
      }

      return createQuery(result, table, operations);
    }),
    rpc: vi.fn((name: string) => {
      operations.push({ table: name, action: 'rpc' });
      const result = results.shift();

      if (!result) {
        throw new Error('Unexpected Supabase RPC call');
      }

      return createQuery(result, name, operations);
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

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    display_name: 'Rita',
    email: 'rita@example.com',
    role: 'owner',
    status: 'active',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    ...overrides,
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

  it('creates server-owned initial participants during password registration', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: userRow(), error: null },
      { data: workspaceRow(), error: null },
      { data: memberRow(), error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: sessionRow(), error: null },
    ], operations);

    const response = await authService.registerUser(supabase, {
      email: 'rita@example.com',
      password: 'password123',
      displayName: 'Rita Nowak',
    });

    expect(response.user.workspaceId).toBe('workspace-1');
    expect(
      operations.find(
        (operation) =>
          operation.table === 'participants' && operation.action === 'insert',
      )?.payload,
    ).toEqual([
      {
        workspace_id: 'workspace-1',
        name: 'Rita Nowak',
        initials: 'RN',
        avatar_color: '#496a8f',
        type: 'adult',
        is_active: true,
        email: 'rita@example.com',
        email_normalized: 'rita@example.com',
        user_id: 'user-1',
      },
      {
        workspace_id: 'workspace-1',
        name: 'Partner',
        initials: 'P',
        avatar_color: '#6b8f71',
        type: 'adult',
        is_active: true,
      },
    ]);
  });

  it('returns clear feedback when a password registration email already exists', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: null, error: { code: '23505' } },
    ]);

    await expect(
      authService.registerUser(supabase, {
        email: 'rita@example.com',
        password: 'password123',
        displayName: 'Rita',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'email_already_registered',
      message: 'An account with this email address already exists. Sign in instead.',
    });
  });

  it('registers an invited password user into the invited workspace without bootstrap rows', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      {
        data: {
          id: 'invitation-1',
          workspace_id: 'workspace-invited',
          email_normalized: 'rita@example.com',
          status: 'pending',
          expires_at: '2026-06-13T10:00:00.000Z',
        },
        error: null,
      },
      { data: userRow(), error: null },
      {
        data: memberRow({
          workspace_id: 'workspace-invited',
          role: 'viewer',
        }),
        error: null,
      },
      { data: [], error: null },
      { data: sessionRow(), error: null },
    ], operations);

    const response = await authService.registerUser(supabase, {
      email: 'rita@example.com',
      password: 'password123',
      displayName: 'Rita',
      invitationToken: 'invitation-token',
    });

    expect(response.user.workspaceId).toBe('workspace-invited');
    expect(response.user.role).toBe('viewer');
    expect(
      operations.some(
        (operation) =>
          operation.table === 'workspaces' || operation.table === 'participants',
      ),
    ).toBe(false);
    expect(
      operations.some(
        (operation) =>
          operation.action === 'rpc' &&
          operation.table === 'accept_participant_invitation',
      ),
    ).toBe(true);
  });

  it('accepts an invitation into the invited workspace and issues a scoped session', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: userRow(), error: null },
      {
        data: [memberRow({
          workspace_id: 'workspace-invited',
          role: 'viewer',
        })],
        error: null,
      },
      { data: [], error: null },
      { data: sessionRow(), error: null },
    ], operations);

    const response = await authService.acceptWorkspaceInvitation(supabase, {
      userId: 'user-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-original',
      role: 'owner',
      planType: 'free',
    }, { token: 'invitation-token' });

    expect(response.user).toMatchObject({
      workspaceId: 'workspace-invited',
      role: 'viewer',
    });
    expect(operations).toContainEqual({
      table: 'accept_participant_invitation',
      action: 'rpc',
    });
  });

  it('rejects invitation acceptance when the signed-in email does not match', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: userRow(), error: null },
      { data: null, error: { message: 'invitation_email_mismatch' } },
    ]);

    await expect(authService.acceptWorkspaceInvitation(supabase, {
      userId: 'user-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-original',
      role: 'owner',
      planType: 'free',
    }, { token: 'invitation-token' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'invitation_email_mismatch',
    });
  });

  it('creates a user, workspace, Google identity, and session for a new Google identity', async () => {
    const { authService } = await loadAuthModules();
    const provider = googleProvider();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: null, error: null },
      { data: null, error: null },
      { data: userRow({ password_hash: null }), error: null },
      { data: googleIdentityRow(), error: null },
      { data: workspaceRow(), error: null },
      { data: memberRow(), error: null },
      { data: null, error: null },
      { data: [{ provider: 'google' }], error: null },
      { data: sessionRow(), error: null },
    ], operations);

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
    expect(
      operations.find(
        (operation) =>
          operation.table === 'participants' && operation.action === 'insert',
      )?.payload,
    ).toEqual([
      expect.objectContaining({
        workspace_id: 'workspace-1',
        name: 'Rita',
        initials: 'R',
        email: 'rita@example.com',
        email_normalized: 'rita@example.com',
        user_id: 'user-1',
      }),
      expect.objectContaining({
        workspace_id: 'workspace-1',
        name: 'Partner',
      }),
    ]);
  });

  it('registers an invited Google user into the invited workspace without bootstrap rows', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          id: 'invitation-1',
          workspace_id: 'workspace-invited',
          email_normalized: 'rita@example.com',
          status: 'pending',
          expires_at: '2026-06-13T10:00:00.000Z',
        },
        error: null,
      },
      { data: userRow({ password_hash: null }), error: null },
      { data: googleIdentityRow(), error: null },
      {
        data: memberRow({
          workspace_id: 'workspace-invited',
          role: 'adult_member',
        }),
        error: null,
      },
      { data: [{ provider: 'google' }], error: null },
      { data: sessionRow(), error: null },
    ], operations);

    const response = await authService.signInWithGoogle(
      supabase,
      { idToken: 'google-id-token', invitationToken: 'invitation-token' },
      googleProvider(),
    );

    expect(response.user.workspaceId).toBe('workspace-invited');
    expect(response.user.role).toBe('adult_member');
    expect(
      operations.some(
        (operation) =>
          operation.table === 'workspaces' || operation.table === 'participants',
      ),
    ).toBe(false);
  });

  it('signs in through an existing Google identity', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: googleIdentityRow(), error: null },
      { data: userRow({ password_hash: null }), error: null },
      { data: [memberRow()], error: null },
      { data: [{ provider: 'google' }], error: null },
      { data: sessionRow(), error: null },
    ], operations);

    const response = await authService.signInWithGoogle(
      supabase,
      { idToken: 'google-id-token' },
      googleProvider(),
    );

    expect(response.user.id).toBe('user-1');
    expect(response.user.workspaceId).toBe('workspace-1');
    expect(
      operations.some((operation) => operation.table === 'participants'),
    ).toBe(false);
  });

  it('cleans up registration when initial participant creation fails', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: userRow(), error: null },
      { data: workspaceRow(), error: null },
      { data: memberRow(), error: null },
      { data: null, error: { code: 'participant_insert_failed' } },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ], operations);

    await expect(
      authService.registerUser(supabase, {
        email: 'rita@example.com',
        password: 'password123',
        displayName: 'Rita',
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'participant_create_failed',
    });

    const fromTables = operations
      .filter((operation) => operation.action === 'from')
      .map((operation) => operation.table);

    expect(fromTables).toEqual([
      'users',
      'workspaces',
      'workspace_members',
      'participants',
      'sessions',
      'workspace_members',
      'workspaces',
      'users',
    ]);
    expect(
      operations.some(
        (operation) =>
          operation.table === 'sessions' && operation.action === 'insert',
      ),
    ).toBe(false);
  });

  it('requires explicit linking when Google matches an existing password account', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: null, error: null },
      { data: userRow(), error: null },
    ], operations);

    await expect(
      authService.signInWithGoogle(
        supabase,
        { idToken: 'google-id-token' },
        googleProvider(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'account_link_required',
    });
    expect(
      operations.some(
        (operation) =>
          operation.action === 'insert' || operation.table === 'sessions',
      ),
    ).toBe(false);
  });

  it('links Google to the authenticated account without password re-entry', async () => {
    const { authService } = await loadAuthModules();
    const operations: SupabaseOperation[] = [];
    const supabase = createSequentialSupabase([
      { data: googleIdentityRow(), error: null },
      { data: userRow(), error: null },
      { data: [memberRow()], error: null },
      { data: [{ provider: 'google' }], error: null },
    ], operations);

    const user = await authService.linkGoogleIdentityForAuthenticatedUser(
      supabase,
      {
        userId: 'user-1',
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        role: 'owner',
        planType: 'free',
      },
      { idToken: 'google-id-token' },
      googleProvider(),
    );

    expect(user.signInMethods).toEqual(['password', 'google']);
    expect(operations).toContainEqual({
      table: 'link_google_auth_identity',
      action: 'rpc',
    });
    expect(
      operations.some((operation) => operation.table === 'sessions'),
    ).toBe(false);
  });

  it('rejects linking a Google account with a different email', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([
      { data: null, error: { message: 'account_link_email_mismatch' } },
    ]);

    await expect(
      authService.linkGoogleIdentityForAuthenticatedUser(
        supabase,
        {
          userId: 'user-1',
          sessionId: 'session-1',
          workspaceId: 'workspace-1',
          role: 'owner',
          planType: 'free',
        },
        { idToken: 'google-id-token' },
        googleProvider(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'account_link_email_mismatch',
    });
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

  it('directs a deleted password account to support after verifying its password', async () => {
    const { authService } = await loadAuthModules();
    const passwordHash = await authService.hashPassword('correct-password');
    const supabase = createSequentialSupabase([
      {
        data: userRow({
          password_hash: passwordHash,
          deleted_at: '2026-09-12T10:00:00.000Z',
        }),
        error: null,
      },
    ]);

    await expect(
      authService.signInUser(supabase, {
        email: 'rita@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'account_deleted',
      message: 'This account was deleted. To restore it, email ourweekapp@gmail.com.',
    });
  });

  it('keeps an incorrect password for a deleted account generic', async () => {
    const { authService } = await loadAuthModules();
    const passwordHash = await authService.hashPassword('correct-password');
    const supabase = createSequentialSupabase([
      {
        data: userRow({
          password_hash: passwordHash,
          deleted_at: '2026-09-12T10:00:00.000Z',
        }),
        error: null,
      },
    ]);

    await expect(
      authService.signInUser(supabase, {
        email: 'rita@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_credentials',
    });
  });

  it('keeps an unknown sign-in email generic', async () => {
    const { authService } = await loadAuthModules();
    const supabase = createSequentialSupabase([{ data: null, error: null }]);

    await expect(
      authService.signInUser(supabase, {
        email: 'missing@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_credentials',
    });
  });
});
