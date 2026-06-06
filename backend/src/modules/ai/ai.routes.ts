import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import { requirePremiumAdultMember } from '../billing/require-premium.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  aiMeetingSummaryRequestSchema,
  aiMeetingSummaryResponseSchema,
} from './ai.schema.js';

const aiErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
  501: errorResponseSchema,
};

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);

  app.post('/meeting-summary', {
    preHandler: [requireAuth, requirePremiumAdultMember(subscriptionsRepository)],
    schema: {
      body: aiMeetingSummaryRequestSchema,
      response: {
        200: aiMeetingSummaryResponseSchema,
        ...aiErrorResponses,
      },
    },
  }, async () => {
    throw new ApiError(
      501,
      'ai_summary_not_implemented',
      'AI summaries are not available yet.',
    );
  });
};

