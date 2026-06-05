import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRoute', () => {
    // Auth routes will issue access tokens and rotate opaque refresh tokens.
  });
};
