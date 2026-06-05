import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRoute', () => {
    // AI routes should proxy provider access without exposing provider keys.
  });
};
