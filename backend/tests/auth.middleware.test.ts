import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
};

const authContext = {
  userId: 'user-1',
  sessionId: 'session-1',
  workspaceId: 'workspace-1',
  role: 'owner' as const,
  planType: 'free' as const,
};

type AuthModules = {
  ApiError: typeof import('../src/shared/errors/api-error.js').ApiError;
  authenticateRequest: typeof import('../src/modules/auth/auth.middleware.js').authenticateRequest;
  issueAccessToken: typeof import('../src/modules/auth/token.service.js').issueAccessToken;
};

async function loadAuthModules(): Promise<AuthModules> {
  Object.assign(process.env, testEnv);
  const [{ authenticateRequest }, { issueAccessToken }, { ApiError }] = await Promise.all([
    import('../src/modules/auth/auth.middleware.js'),
    import('../src/modules/auth/token.service.js'),
    import('../src/shared/errors/api-error.js'),
  ]);

  return { ApiError, authenticateRequest, issueAccessToken };
}

async function validAccessToken(issueAccessToken: AuthModules['issueAccessToken']) {
  return issueAccessToken({
    userId: authContext.userId,
    sessionId: authContext.sessionId,
    workspaceId: authContext.workspaceId,
    role: authContext.role,
  });
}

function requestWithToken(token: string) {
  const warn = vi.fn();
  const error = vi.fn();
  const request = {
    id: 'req-test',
    headers: { authorization: `Bearer ${token}` },
    log: { warn, error },
  } as unknown as FastifyRequest;

  return { error, request, warn };
}

describe('auth middleware Supabase retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries PGRST303 once and attaches the recovered auth context', async () => {
    const { ApiError, authenticateRequest, issueAccessToken } = await loadAuthModules();
    const token = await validAccessToken(issueAccessToken);
    const { request, warn } = requestWithToken(token);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const repository = {
      getAuthenticatedContext: vi
        .fn()
        .mockRejectedValueOnce(
          new ApiError(500, 'auth_workspace_lookup_failed', 'Unable to load auth workspace.', {
            databaseCode: 'PGRST303',
            databaseMessage: 'JWT issued at future',
          }),
        )
        .mockResolvedValueOnce(authContext),
    };

    await authenticateRequest(
      request,
      {} as FastifyReply,
      repository,
      { sleep, getDelayMs: () => 200 },
    );

    expect(repository.getAuthenticatedContext).toHaveBeenCalledTimes(2);
    expect(repository.getAuthenticatedContext).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: authContext.userId,
        sessionId: authContext.sessionId,
        workspaceId: authContext.workspaceId,
      }),
    );
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(200);
    expect(request.auth).toEqual(authContext);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'auth_context_retry',
        databaseCode: 'PGRST303',
        databaseMessage: 'JWT issued at future',
        requestId: 'req-test',
      }),
      'Retrying authentication context lookup',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('authorization');
  });

  it('retries PGRST303 at most once and propagates the second failure', async () => {
    const { ApiError, authenticateRequest, issueAccessToken } = await loadAuthModules();
    const token = await validAccessToken(issueAccessToken);
    const { error, request, warn } = requestWithToken(token);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const firstError = new ApiError(
      500,
      'auth_workspace_lookup_failed',
      'Unable to load auth workspace.',
      { databaseCode: 'PGRST303', databaseMessage: 'JWT issued at future' },
    );
    const secondError = new ApiError(
      500,
      'auth_user_lookup_failed',
      'Unable to load auth user.',
      { databaseCode: 'PGRST303', databaseMessage: 'JWT issued at future' },
    );
    const repository = {
      getAuthenticatedContext: vi
        .fn()
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError),
    };

    await expect(
      authenticateRequest(
        request,
        {} as FastifyReply,
        repository,
        { sleep, getDelayMs: () => 200 },
      ),
    ).rejects.toBe(secondError);

    expect(repository.getAuthenticatedContext).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('does not retry other Supabase errors', async () => {
    const { ApiError, authenticateRequest, issueAccessToken } = await loadAuthModules();
    const token = await validAccessToken(issueAccessToken);
    const { request, warn } = requestWithToken(token);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const repositoryError = new ApiError(
      500,
      'auth_workspace_lookup_failed',
      'Unable to load auth workspace.',
      { databaseCode: 'PGRST999' },
    );
    const repository = {
      getAuthenticatedContext: vi.fn().mockRejectedValueOnce(repositoryError),
    };

    await expect(
      authenticateRequest(
        request,
        {} as FastifyReply,
        repository,
        { sleep, getDelayMs: () => 200 },
      ),
    ).rejects.toBe(repositoryError);

    expect(repository.getAuthenticatedContext).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not retry invalid application access tokens', async () => {
    const { authenticateRequest } = await loadAuthModules();
    const { request } = requestWithToken('invalid-access-token');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const repository = {
      getAuthenticatedContext: vi.fn(),
    };

    await expect(
      authenticateRequest(
        request,
        {} as FastifyReply,
        repository,
        { sleep, getDelayMs: () => 200 },
      ),
    ).rejects.toMatchObject({ statusCode: 401, code: 'unauthenticated' });

    expect(repository.getAuthenticatedContext).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });
});
