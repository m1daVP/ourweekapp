import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { accountRoutes } from '../modules/account/account.routes.js';
import { aiRoutes } from '../modules/ai/ai.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { billingRoutes } from '../modules/billing/billing.routes.js';
import { calendarRoutes } from '../modules/calendar/calendar.routes.js';
import { exportsRoutes } from '../modules/exports/exports.routes.js';
import { workspaceRoutes } from '../modules/workspace/workspace.routes.js';
import { meetingsRoutes } from '../modules/meetings/meetings.routes.js';
import { participantRoutes } from '../modules/participants/participants.routes.js';
import { tasksRoutes } from '../modules/tasks/tasks.routes.js';

export const v1Routes: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(billingRoutes, { prefix: '/subscriptions' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(exportsRoutes, { prefix: '/exports' });
  await app.register(accountRoutes, { prefix: '/account' });
  await app.register(workspaceRoutes, { prefix: '/workspace' });
  await app.register(meetingsRoutes, { prefix: '/meetings' });
  await app.register(participantRoutes, { prefix: '/participants' });
  await app.register(tasksRoutes, { prefix: '/tasks' });
};
