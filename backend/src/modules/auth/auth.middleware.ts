import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';

import { ApiError, isApiError } from '../../shared/errors/index.js';
import { AuthRepository } from './auth.repository.js';
import { verifyAccessToken } from './token.service.js';

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
  repository = new AuthRepository(request.server.supabase),
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
    auth = await repository.getAuthenticatedContext(claims);
  } catch (error) {
    request.log.error(
      {
        err: error,
        code: isApiError(error) ? error.code : authContextLookupError.code,
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
