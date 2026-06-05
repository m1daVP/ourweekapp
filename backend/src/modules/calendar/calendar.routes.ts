import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const calendarRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRoute', () => {
    // Google OAuth connect, callback, and sync endpoints belong here.
  });
};
