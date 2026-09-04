import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { AuthContext } from '../../shared/auth/index.js';
import { env } from '../../config/env.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import {
  aiMeetingSummaryRequestSchema,
  aiMeetingSummaryResponseSchema,
} from './ai.schema.js';
import { createDefaultAiSummaryService } from './ai.service.js';
import { MockAiSummaryProvider } from './mock-ai.client.js';
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
    return {
      output: null,
      usage: null,
      providerRequestId: null,
      providerDurationMs: 0,
    };
  },
};

type AiProviderConfig = Pick<
  typeof env,
  'AI_CONFIGURED' | 'AI_PROVIDER' | 'AI_API_KEY'
>;

export function createAiSummaryProvider(config: AiProviderConfig): AiSummaryProvider {
  if (!config.AI_CONFIGURED) {
    return unavailableAiProvider;
  }

  if (config.AI_PROVIDER === 'mock') {
    return new MockAiSummaryProvider();
  }

  return new OpenAiSummaryProvider(config.AI_API_KEY);
}

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);

  app.post(
    '/meeting-summary',
    {
      config: {
        authRequired: true,
        rateLimit: {
          max: 25,
          timeWindow: '1 hour',
        },
      },
      preHandler: [requireAuth],
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
        createAiSummaryProvider(env),
        {
          aiConfigured: env.AI_CONFIGURED,
          model: env.AI_MODEL,
          providerName: env.AI_PROVIDER,
          logger: request.log,
        },
      );

      return service.generateMeetingSummary(
        requireAuthContext(request),
        request.body,
      );
    },
  );
};

