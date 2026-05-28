import type {
  CalendarConnectionStatus,
  CalendarFollowUpDatePayload,
  CalendarMeetingReminderPayload,
  CalendarSyncResult,
  CalendarTaskDueDatePayload,
} from '@/features/calendar/types';
import { translate } from '@/features/localization/i18n';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionStatus,
  startGoogleCalendarConnection,
  syncGoogleCalendarFollowUpDate,
  syncGoogleCalendarMeetingReminder,
  syncGoogleCalendarTaskDueDate,
} from '@/shared/api/calendarApi';

function nowIso() {
  return new Date().toISOString();
}

function createSetupRequiredStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'setup_required',
    connected: false,
    lastCheckedAt: nowIso(),
    message: translate('calendar.setupRequired'),
  };
}

function createDisconnectedStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'disconnected',
    connected: false,
    lastCheckedAt: nowIso(),
    message: translate('calendar.notConnected'),
  };
}

function createSkippedResult(
  skippedReason: CalendarSyncResult['skippedReason'],
  message: string
): CalendarSyncResult {
  return {
    provider: 'google',
    synced: false,
    attemptedAt: nowIso(),
    skippedReason,
    message,
  };
}

export async function connectCalendar(): Promise<CalendarConnectionStatus> {
  // TODO: Implement Google OAuth through a backend-supported or otherwise
  // securely recommended flow before enabling real calendar connections.
  // Do not store Google access or refresh tokens in frontend localStorage.
  return (await startGoogleCalendarConnection()) ?? createSetupRequiredStatus();
}

export async function disconnectCalendar(): Promise<CalendarConnectionStatus> {
  // TODO: Revoke backend-held Google tokens when the backend calendar
  // connection flow exists. The mobile app should not manage raw tokens.
  return (await disconnectGoogleCalendar()) ?? createDisconnectedStatus();
}

export async function getCalendarConnectionStatus(): Promise<CalendarConnectionStatus> {
  // TODO: Read this from the backend once OAuth and token storage are handled
  // securely outside the mobile app.
  return (
    (await getGoogleCalendarConnectionStatus()) ?? createDisconnectedStatus()
  );
}

export async function syncMeetingReminder(
  payload: CalendarMeetingReminderPayload
): Promise<CalendarSyncResult> {
  if (!payload.startsAt) {
    return createSkippedResult(
      'missing-calendar-date',
      translate('calendar.addMeetingDate')
    );
  }

  return (
    (await syncGoogleCalendarMeetingReminder(payload)) ??
    createSkippedResult(
      'oauth-not-configured',
      translate('calendar.oauthWaiting')
    )
  );
}

export async function syncTaskDueDate(
  payload: CalendarTaskDueDatePayload
): Promise<CalendarSyncResult> {
  if (!payload.dueDate) {
    return createSkippedResult(
      'missing-calendar-date',
      translate('calendar.addTaskDueDate')
    );
  }

  return (
    (await syncGoogleCalendarTaskDueDate(payload)) ??
    createSkippedResult(
      'oauth-not-configured',
      translate('calendar.oauthWaiting')
    )
  );
}

export async function syncFollowUpDate(
  payload: CalendarFollowUpDatePayload
): Promise<CalendarSyncResult> {
  if (!payload.followUpDate) {
    return createSkippedResult(
      'missing-calendar-date',
      translate('calendar.addFollowUpDate')
    );
  }

  return (
    (await syncGoogleCalendarFollowUpDate(payload)) ??
    createSkippedResult(
      'oauth-not-configured',
      translate('calendar.oauthWaiting')
    )
  );
}

export const calendarService = {
  connectCalendar,
  disconnectCalendar,
  getCalendarConnectionStatus,
  syncFollowUpDate,
  syncMeetingReminder,
  syncTaskDueDate,
};
