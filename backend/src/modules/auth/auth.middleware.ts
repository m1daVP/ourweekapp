import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';

import { ApiError, isApiError } from '../../shared/errors/index.js';
import { AuthRepository } from './auth.repository.js';
import { verifyAccessToken, type AccessTokenClaims } from './token.service.js';

const AUTH_CONTEXT_RETRY_MIN_DELAY_MS = 150;
const AUTH_CONTEXT_RETRY_MAX_DELAY_MS = 300;

const unauthorizedError = new ApiError(
  401,
  'unauthenticated',
  'Authentication is required.',
);

const authContextLookupError = new ApiError(
  500,
  'auth_context_lookup_failed',
  'Something went wrong. Please try again.',
);

type AuthContextLoader = Pick<AuthRepository, 'getAuthenticatedContext'>;

type AuthContextRetryOptions = {
  sleep?: (delayMs: number) => Promise<void>;
  getDelayMs?: () => number;
};

type DatabaseDiagnostics = {
  databaseCode?: string;
  databaseMessage?: string;
  databaseHint?: string;
};

function stringDetail(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function databaseDiagnostics(error: unknown): DatabaseDiagnostics {
  if (!isApiError(error)) {
    return {};
  }

  return {
    databaseCode: stringDetail(error.details.databaseCode),
    databaseMessage: stringDetail(error.details.databaseMessage),
    databaseHint: stringDetail(error.details.databaseHint),
  };
}

function isRetryableAuthContextError(error: unknown) {
  return databaseDiagnostics(error).databaseCode === 'PGRST303';
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function authContextRetryDelayMs() {
  const delayRange =
    AUTH_CONTEXT_RETRY_MAX_DELAY_MS - AUTH_CONTEXT_RETRY_MIN_DELAY_MS + 1;

  return AUTH_CONTEXT_RETRY_MIN_DELAY_MS + Math.floor(Math.random() * delayRange);
}

async function loadAuthenticatedContextWithRetry(
  request: FastifyRequest,
  repository: AuthContextLoader,
  claims: AccessTokenClaims,
  options: AuthContextRetryOptions,
) {
  try {
    return await repository.getAuthenticatedContext(claims);
  } catch (error) {
    if (!isRetryableAuthContextError(error)) {
      throw error;
    }

    request.log.warn(
      {
        code: 'auth_context_retry',
        ...databaseDiagnostics(error),
        requestId: request.id,
      },
      'Retrying authentication context lookup',
    );

    await (options.sleep ?? sleep)((options.getDelayMs ?? authContextRetryDelayMs)());

    return repository.getAuthenticatedContext(claims);
  }
}

function parseBearerToken(authorization: unknown) {
  if (typeof authorization !== 'string') {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return null;
  }

  return token;
}

export async function authenticateRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
  repository: AuthContextLoader = new AuthRepository(request.server.supabase),
  retryOptions: AuthContextRetryOptions = {},
) {
  const token = parseBearerToken(request.headers.authorization);

  if (!token) {
    throw unauthorizedError;
  }

  let claims;

  try {
    claims = await verifyAccessToken(token);
  } catch (error) {
    request.log.warn(
      {
        err: error,
        code: unauthorizedError.code,
        requestId: request.id,
      },
      'Access token verification failed',
    );

    throw unauthorizedError;
  }

  let auth;

  try {
    auth = await loadAuthenticatedContextWithRetry(
      request,
      repository,
      claims,
      retryOptions,
    );
  } catch (error) {
    request.log.error(
      {
        err: error,
        code: isApiError(error) ? error.code : authContextLookupError.code,
        ...databaseDiagnostics(error),
        requestId: request.id,
      },
      'Authentication context lookup failed',
    );

    if (isApiError(error) && error.statusCode >= 500) {
      throw error;
    }

    throw authContextLookupError;
  }

  if (!auth) {
    throw unauthorizedError;
  }

  request.auth = auth;
}

export function buildAuthPreHandler(
  app: FastifyInstance,
): preHandlerHookHandler {
  return async (request, reply) => {
    await authenticateRequest(request, reply, new AuthRepository(app.supabase));
  };
}

export const requireAuth = buildAuthPreHandler;
