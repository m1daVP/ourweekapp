import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { accountExportResponseSchema } from './account.schema.js';
import { AccountService } from './account.service.js';

const accountErrorResponses = {
  401: errorResponseSchema,
  404: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = AccountService.fromSupabase(app.supabase);
  const authPreHandler = requireAuth(app);

  app.get('/export', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      response: {
        200: accountExportResponseSchema,
        ...accountErrorResponses,
      },
    },
  }, async (request) => {
    return service.exportAccount(request.auth);
  });

  app.delete('/', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      response: {
        204: z.null(),
        ...accountErrorResponses,
      },
    },
  }, async (request, reply) => {
    await service.deleteAccount(request.auth);

    return reply.status(204).send(null);
  });
};
