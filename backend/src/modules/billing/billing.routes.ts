import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { env } from '../../config/env.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import {
  manageSubscriptionResponseSchema,
  restoreSubscriptionRequestSchema,
  subscriptionStatusSchema,
} from './billing.schema.js';
import { SubscriptionService } from './billing.service.js';
import { RevenueCatClient } from './revenuecat.client.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { AssistantRepository } from '../assistant/assistant.repository.js';

const subscriptionErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
  502: errorResponseSchema,
};

export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new SubscriptionService(
    new SubscriptionsRepository(app.supabase),
    new RevenueCatClient(env.REVENUECAT_API_KEY),
    env.REVENUECAT_ENTITLEMENT_ID,
    new AssistantRepository(app.supabase),
  );
  const authPreHandler = requireAuth(app);

  app.get('/status', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      response: {
        200: subscriptionStatusSchema,
        ...subscriptionErrorResponses,
      },
    },
  }, async (request) => {
    return service.getStatus(request.auth);
  });

  app.post('/restore', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      body: restoreSubscriptionRequestSchema,
      response: {
        200: subscriptionStatusSchema,
        ...subscriptionErrorResponses,
      },
    },
  }, async (request) => {
    return service.restore(request.auth, request.body);
  });

  app.get('/manage', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      response: {
        200: manageSubscriptionResponseSchema,
        ...subscriptionErrorResponses,
      },
    },
  }, async (request) => {
    return service.getManageUrl(request.auth);
  });
};
