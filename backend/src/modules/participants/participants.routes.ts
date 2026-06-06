import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  syncParticipantsRequestSchema,
  syncParticipantsResponseSchema,
} from './participants.schema.js';
import { syncParticipantsWithSupabase } from './participants.service.js';

const participantErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const participantRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/sync', {
    preHandler: requireAuth(app),
    schema: {
      body: syncParticipantsRequestSchema,
      response: {
        200: syncParticipantsResponseSchema,
        ...participantErrorResponses,
      },
    },
  }, async (request) => {
    const auth = requireAuthenticatedContext(request.auth);

    return syncParticipantsWithSupabase(app.supabase, {
      workspaceId: auth.workspaceId,
      body: request.body,
    });
  });
};
