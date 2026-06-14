import type {
  CalendarConnectionStatus,
  CalendarFollowUpDatePayload,
  CalendarMeetingReminderPayload,
  CalendarSyncResult,
  CalendarTaskDueDatePayload,
} from '@/features/calendar/types';
import { translate } from '@/features/localization/i18n';
import { appConfig } from '@/shared/config/env';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionStatus,
  startGoogleCalendarConnection,
  syncGoogleCalendarFollowUpDate,
  syncGoogleCalendarMeetingReminder,
  syncGoogleCalendarTaskDueDate,
} from '@/shared/api/calendarApi';
import { openExternalAuthUrl } from '@/shared/services/externalAuthService';
import { nowIso } from '@/shared/utils/dates';

function createDisconnectedStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'disconnected',
    connected: false,
    lastCheckedAt: nowIso(),
    message: translate('calendar.notConnected'),
  };
}

function createUnavailableStatus(): CalendarConnectionStatus {
  return {
    provider: 'google',
    state: 'unavailable',
    connected: false,
    lastCheckedAt: nowIso(),
    message: translate('calendar.unavailable'),
  };
}

function getCalendarRedirectUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URL('/settings/calendar-sync', window.location.origin).toString();
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
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createUnavailableStatus();
  }

  const connectionStatus =
    (await startGoogleCalendarConnection({
      redirectUrl: getCalendarRedirectUrl(),
    })) ?? createDisconnectedStatus();

  if (connectionStatus.authorizationUrl) {
    openExternalAuthUrl(connectionStatus.authorizationUrl);
  }

  return connectionStatus;
}

export async function disconnectCalendar(): Promise<CalendarConnectionStatus> {
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createUnavailableStatus();
  }

  return (await disconnectGoogleCalendar()) ?? createDisconnectedStatus();
}

export async function getCalendarConnectionStatus(): Promise<CalendarConnectionStatus> {
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createUnavailableStatus();
  }

  return (
    (await getGoogleCalendarConnectionStatus()) ?? createDisconnectedStatus()
  );
}

export async function syncMeetingReminder(
  payload: CalendarMeetingReminderPayload
): Promise<CalendarSyncResult> {
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createSkippedResult(
      'oauth-not-configured',
      translate('calendar.unavailable')
    );
  }

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
      translate('calendar.unavailable')
    )
  );
}

export async function syncTaskDueDate(
  payload: CalendarTaskDueDatePayload
): Promise<CalendarSyncResult> {
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createSkippedResult(
      'oauth-not-configured',
      translate('calendar.unavailable')
    );
  }

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
      translate('calendar.unavailable')
    )
  );
}

export async function syncFollowUpDate(
  payload: CalendarFollowUpDatePayload
): Promise<CalendarSyncResult> {
  if (!appConfig.isGoogleCalendarSyncEnabled) {
    return createSkippedResult(
      'oauth-not-configured',
      translate('calendar.unavailable')
    );
  }

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
      translate('calendar.unavailable')
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
