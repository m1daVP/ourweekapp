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
import { openExternalAuthUrl } from '@/shared/services/externalAuthService';
import { nowIso } from '@/shared/utils/dates';
import { Capacitor } from '@capacitor/core';

export const NATIVE_CALENDAR_REDIRECT_URL = 'weeklyus://calendar-callback';

export function getCalendarRedirectUrl() {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_CALENDAR_REDIRECT_URL;
  }

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
  const connectionStatus = await startGoogleCalendarConnection({
    redirectUrl: getCalendarRedirectUrl(),
  });

  if (connectionStatus.authorizationUrl) {
    openExternalAuthUrl(connectionStatus.authorizationUrl);
  }

  return connectionStatus;
}

export async function disconnectCalendar(): Promise<CalendarConnectionStatus> {
  return disconnectGoogleCalendar();
}

export async function getCalendarConnectionStatus(): Promise<CalendarConnectionStatus> {
  return getGoogleCalendarConnectionStatus();
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

  return syncGoogleCalendarMeetingReminder(payload);
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

  return syncGoogleCalendarTaskDueDate(payload);
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

  return syncGoogleCalendarFollowUpDate(payload);
}

export const calendarService = {
  connectCalendar,
  disconnectCalendar,
  getCalendarConnectionStatus,
  syncFollowUpDate,
  syncMeetingReminder,
  syncTaskDueDate,
};
