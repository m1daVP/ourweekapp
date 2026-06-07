import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { AuthContext } from '../../shared/auth/index.js';
import { env } from '../../config/env.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import { requirePremiumAdultMember } from '../billing/require-premium.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  aiMeetingSummaryRequestSchema,
  aiMeetingSummaryResponseSchema,
} from './ai.schema.js';
import { createDefaultAiSummaryService } from './ai.service.js';
import { OpenAiSummaryProvider, type AiSummaryProvider } from './openai.client.js';

const aiErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  429: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
  503: errorResponseSchema,
};

function requireAuthContext(request: { auth?: AuthContext }) {
  if (!request.auth) {
    throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
  }

  return request.auth;
}

const unavailableAiProvider: AiSummaryProvider = {
  async generateMeetingSummary() {
    return null;
  },
};

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);

  app.post(
    '/meeting-summary',
    {
      config: {
        authRequired: true,
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
        },
      },
      preHandler: [requireAuth, requirePremiumAdultMember(subscriptionsRepository)],
      schema: {
        body: aiMeetingSummaryRequestSchema,
        response: {
          200: aiMeetingSummaryResponseSchema,
          ...aiErrorResponses,
        },
      },
    },
    async (request) => {
      const service = createDefaultAiSummaryService(
        app.supabase,
        env.AI_CONFIGURED
          ? new OpenAiSummaryProvider(env.OPENAI_API_KEY)
          : unavailableAiProvider,
        {
          aiConfigured: env.AI_CONFIGURED,
          model: env.AI_MODEL,
          providerName: env.AI_PROVIDER,
        },
      );

      return service.generateMeetingSummary(
        requireAuthContext(request),
        request.body,
      );
    },
  );
};

