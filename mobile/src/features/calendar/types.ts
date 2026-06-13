export type CalendarProvider = 'google';

export type CalendarConnectionState =
  | 'disconnected'
  | 'connected'
  | 'setup_required'
  | 'unavailable';

export interface CalendarConnectionStatus {
  provider: CalendarProvider;
  state: CalendarConnectionState;
  connected: boolean;
  connectedAccountEmail?: string;
  lastCheckedAt: string;
  message: string;
  authorizationUrl?: string;
}

export interface CalendarSyncSettings {
  addWeeklyMeetingReminder: boolean;
  addTaskDueDates: boolean;
  addFollowUpDates: boolean;
  updatedAt: string;
}

export interface CalendarMeetingReminderPayload {
  meetingId: string;
  title: string;
  startsAt?: string;
}

export interface CalendarTaskDueDatePayload {
  taskId: string;
  title: string;
  dueDate?: string;
}

export interface CalendarFollowUpDatePayload {
  followUpId: string;
  title: string;
  followUpDate?: string;
  sourceMeetingId?: string;
}

export interface CalendarSyncResult {
  provider: CalendarProvider;
  synced: boolean;
  attemptedAt: string;
  skippedReason:
    | 'not-connected'
    | 'oauth-not-configured'
    | 'missing-calendar-date';
  message: string;
}
