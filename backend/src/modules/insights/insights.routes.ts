import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireFeature } from '../billing/require-feature.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  insightsQuerySchema,
  insightsResponseSchema,
  insightsSearchQuerySchema,
  insightsSearchResponseSchema,
} from './insights.schema.js';
import { InsightsService } from './insights.service.js';

const errorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const insightsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = InsightsService.fromSupabase(app.supabase);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);
  const preHandler = [
    requireAuth(app),
    requireFeature(subscriptionsRepository, 'advancedStatistics'),
  ];

  app.get(
    '/',
    {
      config: { authRequired: true },
      preHandler,
      schema: {
        querystring: insightsQuerySchema,
        response: {
          200: insightsResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => service.getInsights(request.auth, request.query),
  );

  app.get(
    '/search',
    {
      config: { authRequired: true },
      preHandler,
      schema: {
        querystring: insightsSearchQuerySchema,
        response: {
          200: insightsSearchResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => service.search(request.auth, request.query),
  );
};
