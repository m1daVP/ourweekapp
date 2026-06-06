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
  authorizationUrl: z.string().url().optional(),
});

export const calendarConnectRequestSchema = z.object({
  redirectUrl: z
    .string()
    .trim()
    .url()
    .max(VALIDATION_LIMITS.calendarRedirectUrlMaxLength),
});

export const calendarSyncResultSchema = z.object({
  provider: calendarProviderSchema,
  synced: z.boolean(),
  attemptedAt: isoDateTimeStringSchema,
  skippedReason: calendarSyncSkippedReasonSchema.optional(),
  message: calendarMessageSchema,
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
export type CalendarSyncSkippedReasonDto = z.infer<
  typeof calendarSyncSkippedReasonSchema
>;
export type CalendarSyncResultDto = z.infer<typeof calendarSyncResultSchema>;
export type CalendarConnectRequestDto = z.infer<
  typeof calendarConnectRequestSchema
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
