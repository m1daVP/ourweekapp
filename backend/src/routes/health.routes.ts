import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const liveResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

const readyResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  uptime: z.number(),
  checks: z.object({
    database: z.enum(['ok', 'error']),
  }),
});

function liveResponse() {
  return {
    status: 'ok' as const,
    uptime: process.uptime(),
  };
}

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: liveResponseSchema,
        },
      },
    },
    async () => liveResponse(),
  );

  app.get(
    '/health/live',
    {
      schema: {
        response: {
          200: liveResponseSchema,
        },
      },
    },
    async () => liveResponse(),
  );

  app.get(
    '/health/ready',
    {
      schema: {
        response: {
          200: readyResponseSchema,
          503: readyResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { error } = await app.supabase
        .from('workspaces')
        .select('id')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        request.log.warn({ err: error }, 'readiness database check failed');

        return reply.status(503).send({
          status: 'error' as const,
          uptime: process.uptime(),
          checks: {
            database: 'error' as const,
          },
        });
      }

      return {
        status: 'ok' as const,
        uptime: process.uptime(),
        checks: {
          database: 'ok' as const,
        },
      };
    },
  );
};
