import { z } from 'zod';

import {
  apiIdSchema,
  emailSchema,
  isoDateStringSchema,
  isoDateTimeStringSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';

export const calendarProviderSchema = z.literal('google');

export const calendarConnectionStateSchema = z.enum([
  'disconnected',
  'connected',
  'setup_required',
]);

export const calendarSyncSkippedReasonSchema = z.enum([
  'not-connected',
  'missing-calendar-date',
  'setup-required',
  'premium-required',
  'provider-error',
]);

export const calendarWeekdaySchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

export const calendarPreferencesSchema = z.object({
  weeklyMeetingSyncEnabled: z.boolean(),
  assignedTaskSyncEnabled: z.boolean(),
  weeklyMeetingDay: calendarWeekdaySchema,
  weeklyMeetingTime: z.string().regex(/^\d{2}:\d{2}$/),
  timeZone: z.string().trim().min(1).max(100),
  lastSyncErrorCode: z.literal('provider-error').optional(),
  lastSyncAttemptedAt: isoDateTimeStringSchema.optional(),
});

export const updateCalendarPreferencesSchema = z.object({
  weeklyMeetingSyncEnabled: z.boolean().optional(),
  assignedTaskSyncEnabled: z.boolean().optional(),
  weeklyMeetingDay: calendarWeekdaySchema.optional(),
  weeklyMeetingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeZone: z.string().trim().min(1).max(100).optional(),
}).superRefine((value, ctx) => {
  const scheduleFields = [
    value.weeklyMeetingDay,
    value.weeklyMeetingTime,
    value.timeZone,
  ];

  if (scheduleFields.some((field) => field !== undefined) && scheduleFields.some((field) => field === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Weekly meeting schedule must be updated together.' });
  }

  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one calendar setting is required.' });
  }
});

export const calendarMessageSchema = trimmedString(
  1,
  VALIDATION_LIMITS.summaryTextMaxLength,
);

export const calendarConnectionStatusSchema = z.object({
  provider: calendarProviderSchema,
  state: calendarConnectionStateSchema,
  connected: z.boolean(),
  connectedAccountEmail: emailSchema.nullable(),
  lastCheckedAt: isoDateTimeStringSchema,
  message: calendarMessageSchema,
  preferences: calendarPreferencesSchema,
  authorizationUrl: z.string().url().optional(),
});

export const calendarConnectRequestSchema = z.object({
  redirectUrl: z
    .string()
    .trim()
    .url()
    .max(VALIDATION_LIMITS.calendarRedirectUrlMaxLength),
});

export const calendarGoogleCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1),
  error: z.string().trim().min(1).optional(),
});

export const calendarSyncResultSchema = z.object({
  provider: calendarProviderSchema,
  synced: z.boolean(),
  attemptedAt: isoDateTimeStringSchema,
  skippedReason: calendarSyncSkippedReasonSchema.optional(),
  message: calendarMessageSchema,
  providerEventId: z.string().trim().min(1).optional(),
});

export const calendarMeetingReminderRequestSchema = z.object({
  meetingId: apiIdSchema,
  title: trimmedString(1, VALIDATION_LIMITS.calendarTitleMaxLength),
  startsAt: isoDateTimeStringSchema.optional(),
});

export const calendarTaskDueDateRequestSchema = z.object({
  taskId: apiIdSchema,
  title: trimmedString(1, VALIDATION_LIMITS.calendarTitleMaxLength),
  dueDate: isoDateStringSchema.optional(),
});

export const calendarFollowUpDateRequestSchema = z.object({
  followUpId: apiIdSchema,
  title: trimmedString(1, VALIDATION_LIMITS.calendarTitleMaxLength),
  followUpDate: isoDateStringSchema.optional(),
  sourceMeetingId: apiIdSchema,
});

export type CalendarProviderDto = z.infer<typeof calendarProviderSchema>;
export type CalendarConnectionStateDto = z.infer<
  typeof calendarConnectionStateSchema
>;
export type CalendarConnectionStatusDto = z.infer<
  typeof calendarConnectionStatusSchema
>;
export type CalendarPreferencesDto = z.infer<typeof calendarPreferencesSchema>;
export type UpdateCalendarPreferencesDto = z.infer<typeof updateCalendarPreferencesSchema>;
export type CalendarSyncSkippedReasonDto = z.infer<
  typeof calendarSyncSkippedReasonSchema
>;
export type CalendarSyncResultDto = z.infer<typeof calendarSyncResultSchema>;
export type CalendarConnectRequestDto = z.infer<
  typeof calendarConnectRequestSchema
>;
export type CalendarGoogleCallbackQueryDto = z.infer<
  typeof calendarGoogleCallbackQuerySchema
>;
export type CalendarMeetingReminderRequestDto = z.infer<
  typeof calendarMeetingReminderRequestSchema
>;
export type CalendarTaskDueDateRequestDto = z.infer<
  typeof calendarTaskDueDateRequestSchema
>;
export type CalendarFollowUpDateRequestDto = z.infer<
  typeof calendarFollowUpDateRequestSchema
>;
