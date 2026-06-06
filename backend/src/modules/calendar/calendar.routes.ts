import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { buildAuthPreHandler } from '../auth/auth.middleware.js';
import { requirePremiumAdultMember } from '../billing/require-premium.middleware.js';
import { SubscriptionsRepository } from '../billing/subscriptions.repository.js';
import {
  calendarConnectRequestSchema,
  calendarConnectionStatusSchema,
  calendarFollowUpDateRequestSchema,
  calendarMeetingReminderRequestSchema,
  calendarSyncResultSchema,
  calendarTaskDueDateRequestSchema,
  type CalendarConnectionStatusDto,
  type CalendarSyncResultDto,
} from './calendar.schema.js';

const calendarErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

function disconnectedStatus(now = new Date()): CalendarConnectionStatusDto {
  return {
    provider: 'google',
    state: 'disconnected',
    connected: false,
    connectedAccountEmail: null,
    lastCheckedAt: now.toISOString(),
    message: 'Google Calendar is not connected.',
  };
}

function notConnectedSyncResult(now = new Date()): CalendarSyncResultDto {
  return {
    provider: 'google',
    synced: false,
    attemptedAt: now.toISOString(),
    skippedReason: 'not-connected',
    message: 'Connect Google Calendar before syncing reminders.',
  };
}

export const calendarRoutes: FastifyPluginAsyncZod = async (app) => {
  const requireAuth = buildAuthPreHandler(app);
  const subscriptionsRepository = new SubscriptionsRepository(app.supabase);
  const requirePremiumWorkspace = requirePremiumAdultMember(subscriptionsRepository);

  app.get('/google/status', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => disconnectedStatus());

  app.post('/google/connect', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarConnectRequestSchema,
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => ({
    ...disconnectedStatus(),
    state: 'setup_required' as const,
    message: 'Google Calendar setup is not available yet.',
  }));

  app.post('/google/disconnect', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      response: {
        200: calendarConnectionStatusSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => disconnectedStatus());

  app.post('/google/meeting-reminders', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarMeetingReminderRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => notConnectedSyncResult());

  app.post('/google/task-due-dates', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarTaskDueDateRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => notConnectedSyncResult());

  app.post('/google/follow-up-dates', {
    preHandler: [requireAuth, requirePremiumWorkspace],
    schema: {
      body: calendarFollowUpDateRequestSchema,
      response: {
        200: calendarSyncResultSchema,
        ...calendarErrorResponses,
      },
    },
  }, async () => notConnectedSyncResult());
};

