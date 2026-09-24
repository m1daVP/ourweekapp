import type {
  CalendarConnectionStatus,
  CalendarFollowUpDatePayload,
  CalendarMeetingReminderPayload,
  CalendarSyncResult,
  CalendarTaskDueDatePayload,
  UpdateCalendarPreferences,
} from '@/features/calendar/types';
import { apiRequest } from './httpClient';

export interface StartGoogleCalendarConnectionRequestDto {
  redirectUrl: string;
}

export async function getGoogleCalendarConnectionStatus(): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/calendar/google/status', {
    requiresAuth: true,
  });
}

export async function startGoogleCalendarConnection(
  payload: StartGoogleCalendarConnectionRequestDto
): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/calendar/google/connect', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function disconnectGoogleCalendar(): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/calendar/google/disconnect', {
    method: 'POST',
    requiresAuth: true,
  });
}

export async function updateGoogleCalendarSettings(
  payload: UpdateCalendarPreferences
): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/calendar/google/settings', {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
  });
}

export async function retryGoogleCalendarSync(): Promise<CalendarSyncResult> {
  return apiRequest<CalendarSyncResult>('/calendar/google/retry', {
    method: 'POST',
    requiresAuth: true,
  });
}

export async function syncGoogleCalendarMeetingReminder(
  payload: CalendarMeetingReminderPayload
): Promise<CalendarSyncResult> {
  return apiRequest<CalendarSyncResult>('/calendar/google/meeting-reminders', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function syncGoogleCalendarTaskDueDate(
  payload: CalendarTaskDueDatePayload
): Promise<CalendarSyncResult> {
  return apiRequest<CalendarSyncResult>('/calendar/google/task-due-dates', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function syncGoogleCalendarFollowUpDate(
  payload: CalendarFollowUpDatePayload
): Promise<CalendarSyncResult> {
  return apiRequest<CalendarSyncResult>('/calendar/google/follow-up-dates', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}
