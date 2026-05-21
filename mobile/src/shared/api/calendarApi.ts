import type {
  CalendarConnectionStatus,
  CalendarFollowUpDatePayload,
  CalendarMeetingReminderPayload,
  CalendarSyncResult,
  CalendarTaskDueDatePayload,
} from '@/features/calendar/types';
import { apiRequest, isBackendApiConfigured } from './httpClient';

export async function getGoogleCalendarConnectionStatus(): Promise<CalendarConnectionStatus | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarConnectionStatus>('/calendar/google/status');
}

export async function startGoogleCalendarConnection(): Promise<CalendarConnectionStatus | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarConnectionStatus>('/calendar/google/connect', {
    method: 'POST',
  });
}

export async function disconnectGoogleCalendar(): Promise<CalendarConnectionStatus | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarConnectionStatus>('/calendar/google/disconnect', {
    method: 'POST',
  });
}

export async function syncGoogleCalendarMeetingReminder(
  payload: CalendarMeetingReminderPayload
): Promise<CalendarSyncResult | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarSyncResult>('/calendar/google/meeting-reminders', {
    method: 'POST',
    body: payload,
  });
}

export async function syncGoogleCalendarTaskDueDate(
  payload: CalendarTaskDueDatePayload
): Promise<CalendarSyncResult | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarSyncResult>('/calendar/google/task-due-dates', {
    method: 'POST',
    body: payload,
  });
}

export async function syncGoogleCalendarFollowUpDate(
  payload: CalendarFollowUpDatePayload
): Promise<CalendarSyncResult | null> {
  if (!isBackendApiConfigured()) {
    return null;
  }

  return apiRequest<CalendarSyncResult>('/calendar/google/follow-up-dates', {
    method: 'POST',
    body: payload,
  });
}
