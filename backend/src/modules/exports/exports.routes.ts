import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireFeature } from '../billing/require-feature.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  exportMeetingRequestSchema,
  exportMeetingResponseSchema,
} from './exports.schema.js';
import { ExportsService } from './exports.service.js';

const exportErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const exportsRoutes: FastifyPluginAsyncZod = async (app) => {
  const authPreHandler = requireAuth(app);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);
  const service = ExportsService.fromSupabase(app.supabase);

  app.post(
    '/meeting',
    {
      config: {
        authRequired: true,
      },
      preHandler: [
        authPreHandler,
        requireFeature(subscriptionsRepository, 'export'),
      ],
      schema: {
        body: exportMeetingRequestSchema,
        response: {
          200: exportMeetingResponseSchema,
          ...exportErrorResponses,
        },
      },
    },
    async (request) => {
      return service.exportMeeting(request.auth, request.body);
    },
  );
};
