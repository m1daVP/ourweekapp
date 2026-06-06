import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import { createDefaultMeetingsService } from './meetings.service.js';
import {
  meetingParamsSchema,
  meetingSchema,
  meetingsResponseSchema,
  saveMeetingSummaryRequestSchema,
  syncMeetingsRequestSchema,
  syncMeetingsResponseSchema,
} from './meetings.schema.js';

const meetingErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

function requireAuthContext(request: { auth?: AuthContext }) {
  if (!request.auth) {
    throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
  }

  return request.auth;
}

export const meetingsRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);

  app.get('/', {
    preHandler: requireAuth,
    schema: {
      response: {
        200: meetingsResponseSchema,
        ...meetingErrorResponses,
      },
    },
  }, async (request) => {
    const service = createDefaultMeetingsService(app.supabase);

    return service.listMeetings(requireAuthContext(request));
  });

  app.post('/sync', {
    preHandler: requireAuth,
    schema: {
      body: syncMeetingsRequestSchema,
      response: {
        200: syncMeetingsResponseSchema,
        ...meetingErrorResponses,
      },
    },
  }, async (request) => {
    const service = createDefaultMeetingsService(app.supabase);

    return service.syncMeetings(requireAuthContext(request), request.body);
  });

  app.put('/:id/summary', {
    preHandler: requireAuth,
    schema: {
      params: meetingParamsSchema,
      body: saveMeetingSummaryRequestSchema,
      response: {
        200: meetingSchema,
        ...meetingErrorResponses,
      },
    },
  }, async (request) => {
    const service = createDefaultMeetingsService(app.supabase);

    return service.saveMeetingSummary(
      requireAuthContext(request),
      request.params.id,
      request.body.summary,
    );
  });
};




