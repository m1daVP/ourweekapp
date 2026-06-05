import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRoute', () => {
    // RevenueCat webhook and entitlement validation endpoints belong here.
  });
};
