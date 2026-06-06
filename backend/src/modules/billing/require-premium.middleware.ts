import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { requireAuthenticatedContext, requireMinimumRole } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { hasTrustedPremiumEntitlement } from './billing.service.js';
import type {
  SubscriptionDto,
  SubscriptionRecord,
  SubscriptionsRepository,
} from './subscriptions.repository.js';

type SubscriptionEntitlementRepository = Pick<
  SubscriptionsRepository,
  'findCurrentSubscriptionForWorkspace'
>;

export async function assertPremiumEntitlement(
  repository: SubscriptionEntitlementRepository,
  auth: FastifyRequest['auth'],
  now = new Date(),
) {
  const context = requireAuthenticatedContext(auth);
  const subscription =
    (await repository.findCurrentSubscriptionForWorkspace(
      context.workspaceId,
    )) as SubscriptionDto | SubscriptionRecord | null;

  if (!hasTrustedPremiumEntitlement(subscription, now)) {
    throw new ApiError(
      403,
      'premium_required',
      'Premium is required for this feature.',
    );
  }

  return context;
}

export function requirePremium(
  repository: SubscriptionEntitlementRepository,
): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    await assertPremiumEntitlement(repository, request.auth);
  };
}

export function requirePremiumAdultMember(
  repository: SubscriptionEntitlementRepository,
): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    requireMinimumRole(request.auth, 'adult_member');
    await assertPremiumEntitlement(repository, request.auth);
  };
}
