import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { createDefaultTasksService } from './tasks.service.js';
import {
  syncTasksRequestSchema,
  syncTasksResponseSchema,
  tasksResponseSchema,
} from './tasks.schema.js';

const taskErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const tasksRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    config: {
      authRequired: true,
    },
    preHandler: requireAuth(app),
    schema: {
      response: {
        200: tasksResponseSchema,
        ...taskErrorResponses,
      },
    },
  }, async (request) => {
    const auth = requireAuthenticatedContext(request.auth);
    const service = createDefaultTasksService(app.supabase);

    return service.listTasks(auth);
  });

  app.post('/sync', {
    config: {
      authRequired: true,
    },
    preHandler: requireAuth(app),
    schema: {
      body: syncTasksRequestSchema,
      response: {
        200: syncTasksResponseSchema,
        ...taskErrorResponses,
      },
    },
  }, async (request) => {
    const auth = requireAuthenticatedContext(request.auth);
    const service = createDefaultTasksService(app.supabase);

    return service.syncTasks(auth, request.body);
  });
};
