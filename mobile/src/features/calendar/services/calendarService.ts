import type {
  CalendarConnectionStatus,
  CalendarMeetingReminderPayload,
  CalendarSyncResult,
  CalendarTaskDueDatePayload,
} from '@/features/calendar/types';

function nowIso() {
  return new Date().toISOString();
}

function createSetupRequiredStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'setup_required',
    connected: false,
    lastCheckedAt: nowIso(),
    message:
      'Google Calendar connection is prepared, but secure OAuth is not configured yet.',
  };
}

function createDisconnectedStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'disconnected',
    connected: false,
    lastCheckedAt: nowIso(),
    message: 'Google Calendar is not connected.',
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
  return createSetupRequiredStatus();
}

export async function disconnectCalendar(): Promise<CalendarConnectionStatus> {
  // TODO: Revoke backend-held Google tokens when the backend calendar
  // connection flow exists. The mobile app should not manage raw tokens.
  return createDisconnectedStatus();
}

export async function getCalendarConnectionStatus(): Promise<CalendarConnectionStatus> {
  // TODO: Read this from the backend once OAuth and token storage are handled
  // securely outside the mobile app.
  return createDisconnectedStatus();
}

export async function syncMeetingReminder(
  payload: CalendarMeetingReminderPayload
): Promise<CalendarSyncResult> {
  if (!payload.startsAt) {
    return createSkippedResult(
      'missing-calendar-date',
      'Add a meeting date before syncing a calendar reminder.'
    );
  }

  return createSkippedResult(
    'oauth-not-configured',
    'Calendar sync is waiting for a secure Google connection flow.'
  );
}

export async function syncTaskDueDate(
  payload: CalendarTaskDueDatePayload
): Promise<CalendarSyncResult> {
  if (!payload.dueDate) {
    return createSkippedResult(
      'missing-calendar-date',
      'Add a task due date before syncing it to Google Calendar.'
    );
  }

  return createSkippedResult(
    'oauth-not-configured',
    'Calendar sync is waiting for a secure Google connection flow.'
  );
}

export const calendarService = {
  connectCalendar,
  disconnectCalendar,
  getCalendarConnectionStatus,
  syncMeetingReminder,
  syncTaskDueDate,
};
