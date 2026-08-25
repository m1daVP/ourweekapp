import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import {
  assertFeatureAccess,
  type SubscriptionFeatureKey,
} from './feature-access.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';

type SubscriptionEntitlementRepository = Pick<
  SubscriptionsRepository,
  'findCurrentSubscriptionForWorkspace'
>;

export function requireFeature(
  repository: SubscriptionEntitlementRepository,
  featureKey: SubscriptionFeatureKey,
): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    await assertFeatureAccess(repository, request.auth, featureKey);
  };
}
