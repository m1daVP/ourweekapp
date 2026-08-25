import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import { requireFeature } from '../billing/require-feature.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  calendarConnectRequestSchema,
  calendarConnectionStatusSchema,
  calendarFollowUpDateRequestSchema,
  calendarGoogleCallbackQuerySchema,
  calendarMeetingReminderRequestSchema,
  calendarSyncResultSchema,
  calendarTaskDueDateRequestSchema,
} from './calendar.schema.js';
import { createDefaultCalendarService } from './calendar.service.js';
import { googleCalendarProvider } from './google-oauth.client.js';

const calendarErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

export const calendarRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);
  const requirePremiumWorkspace = requireFeature(
    subscriptionsRepository,
    'googleCalendarSync',
  );
  const calendarService = createDefaultCalendarService(
    app.supabase,
    googleCalendarProvider,
  );

  app.get('/google/status', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.getGoogleStatus(
    requireAuthenticatedContext(request.auth),
  ));

  app.post('/google/connect', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarConnectRequestSchema,
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.connectGoogle(
    requireAuthenticatedContext(request.auth),
    request.body,
  ));

  app.get('/google/callback', {
    schema: {
      querystring: calendarGoogleCallbackQuerySchema,
      response: {
        422: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const redirectUrl = await calendarService.handleGoogleCallback(request.query);

    return reply.redirect(redirectUrl);
  });

  app.post('/google/disconnect', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.disconnectGoogle(
    requireAuthenticatedContext(request.auth),
  ));

  app.post('/google/meeting-reminders', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarMeetingReminderRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.syncMeetingReminder(
    requireAuthenticatedContext(request.auth),
    request.body,
  ));

  app.post('/google/task-due-dates', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarTaskDueDateRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.syncTaskDueDate(
    requireAuthenticatedContext(request.auth),
    request.body,
  ));

  app.post('/google/follow-up-dates', {
    config: {
      authRequired: true,
    },
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarFollowUpDateRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async (request) => calendarService.syncFollowUpDate(
    requireAuthenticatedContext(request.auth),
    request.body,
  ));
};
