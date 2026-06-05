import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { aiRoutes } from '../modules/ai/ai.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { billingRoutes } from '../modules/billing/billing.routes.js';
import { calendarRoutes } from '../modules/calendar/calendar.routes.js';

export const v1Routes: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(aiRoutes, { prefix: '/ai' });
};
