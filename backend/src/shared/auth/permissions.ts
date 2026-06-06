import type { AuthContext, UserRole } from './context.js';
import { ApiError } from '../errors/index.js';

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  adult_member: 2,
  owner: 3,
};

export function requireAuthenticatedContext(
  auth: AuthContext | undefined,
): AuthContext {
  if (!auth) {
    throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
  }

  return auth;
}

export function requireMinimumRole(
  auth: AuthContext | undefined,
  minimumRole: UserRole,
) {
  const context = requireAuthenticatedContext(auth);

  if (roleRank[context.role] < roleRank[minimumRole]) {
    throw new ApiError(
      403,
      'forbidden',
      'You are not allowed to perform this action.',
    );
  }

  return context;
}
