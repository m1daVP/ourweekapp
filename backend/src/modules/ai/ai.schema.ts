import { z } from 'zod';

import {
  apiIdSchema,
  isoDateStringSchema,
  isoDateTimeStringSchema,
  serverRevisionSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';
import { taskTitleSchema } from '../tasks/tasks.schema.js';

export const summaryTextSchema = trimmedString(
  0,
  VALIDATION_LIMITS.summaryTextMaxLength,
);

export const requiredSummaryTextSchema = trimmedString(
  1,
  VALIDATION_LIMITS.summaryTextMaxLength,
);

export const summaryTextListSchema = z
  .array(requiredSummaryTextSchema)
  .max(VALIDATION_LIMITS.summaryListItemsMax);

export const meetingSummaryTaskSchema = z.object({
  title: taskTitleSchema,
  responsibleParticipantIds: z.array(apiIdSchema).optional(),
  dueDate: isoDateStringSchema.optional(),
});

export const meetingSummarySchema = z.object({
  id: apiIdSchema,
  meetingId: apiIdSchema,
  shortSummary: requiredSummaryTextSchema,
  mainTopics: summaryTextListSchema,
  keyTensions: summaryTextListSchema,
  agreements: summaryTextListSchema,
  tasks: z
    .array(meetingSummaryTaskSchema)
    .max(VALIDATION_LIMITS.summaryListItemsMax),
  suggestedNextMeetingFocus: summaryTextListSchema,
  createdAt: isoDateTimeStringSchema,
});

export const aiSummaryLocaleSchema = z.enum(['en', 'uk', 'es']);
export type AiSummaryLocale = z.infer<typeof aiSummaryLocaleSchema>;

export const aiMeetingSummaryRequestSchema = z.object({
  meetingId: apiIdSchema,
  locale: aiSummaryLocaleSchema.optional(),
  expectedServerRevision: serverRevisionSchema.optional(),
  allowLowContent: z.boolean().optional(),
});

export const aiMeetingSyncSchema = z.object({
  meetingId: apiIdSchema,
  sourceServerRevision: serverRevisionSchema,
  serverRevision: serverRevisionSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const aiMeetingSummaryResponseSchema = z.object({
  summary: meetingSummarySchema,
  disclaimer: requiredSummaryTextSchema,
  generatedAt: isoDateTimeStringSchema,
  meetingSync: aiMeetingSyncSchema,
});

export type MeetingSummaryTaskDto = z.infer<typeof meetingSummaryTaskSchema>;
export type MeetingSummaryDto = z.infer<typeof meetingSummarySchema>;
export type AiMeetingSummaryRequestDto = z.infer<
  typeof aiMeetingSummaryRequestSchema
>;
export type AiMeetingSummaryResponseDto = z.infer<
  typeof aiMeetingSummaryResponseSchema
>;
