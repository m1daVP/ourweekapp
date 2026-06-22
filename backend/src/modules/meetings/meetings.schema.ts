import { z } from 'zod';

import {
  apiIdSchema,
  createTypedSyncConflictSchema,
  isoDateStringSchema,
  isoDateTimeStringSchema,
  optionalTrimmedString,
  serverRevisionSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';
import { meetingSummarySchema } from '../ai/ai.schema.js';
import {
  agreementDescriptionSchema,
  taskDescriptionSchema,
  taskResponsibilityTypeSchema,
  taskStatusSchema,
  taskTitleSchema,
} from '../tasks/tasks.schema.js';

export const meetingIdSchema = z.uuid();

export const meetingStatusSchema = z.enum([
  'draft',
  'in_progress',
  'paused',
  'incomplete',
  'completed',
]);

export const meetingTitleSchema = trimmedString(
  VALIDATION_LIMITS.meetingTitleMinLength,
  VALIDATION_LIMITS.meetingTitleMaxLength,
);

export const meetingTemplateIdSchema = trimmedString(
  1,
  VALIDATION_LIMITS.apiIdMaxLength,
);

export const meetingNoteTextSchema = trimmedString(
  1,
  VALIDATION_LIMITS.meetingNoteTextMaxLength,
);

const meetingSummaryForMeetingSchema = meetingSummarySchema.extend({
  meetingId: meetingIdSchema,
});

export const meetingSectionNoteSchema = z.object({
  id: apiIdSchema.optional(),
  participantId: apiIdSchema.optional(),
  text: meetingNoteTextSchema,
  createdAt: isoDateTimeStringSchema.optional(),
  updatedAt: isoDateTimeStringSchema.optional(),
});

export const meetingSectionTaskSchema = z.object({
  id: apiIdSchema.optional(),
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  responsibilityType: taskResponsibilityTypeSchema,
  responsibleParticipantIds: z.array(apiIdSchema).optional(),
  dueDate: isoDateStringSchema.optional(),
  status: taskStatusSchema.optional(),
});

const meetingSectionAgreementBaseSchema = z.object({
  id: apiIdSchema.optional(),
  text: trimmedString(
    VALIDATION_LIMITS.agreementTitleMinLength,
    VALIDATION_LIMITS.agreementTitleMaxLength,
  ),
  description: agreementDescriptionSchema,
  participantIds: z.array(apiIdSchema).optional(),
  relatedTaskIds: z.array(apiIdSchema).optional(),
});

export const meetingSectionAgreementSchema = z.preprocess((value) => {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !('text' in value) &&
    'title' in value
  ) {
    return {
      ...value,
      text: (value as { title?: unknown }).title,
    };
  }

  return value;
}, meetingSectionAgreementBaseSchema);

export const meetingSectionSchema = z.object({
  id: apiIdSchema,
  title: optionalTrimmedString(VALIDATION_LIMITS.meetingTitleMaxLength),
  prompt: optionalTrimmedString(VALIDATION_LIMITS.meetingNoteTextMaxLength),
  notes: z
    .array(meetingSectionNoteSchema)
    .max(VALIDATION_LIMITS.notesPerMeetingSectionMax)
    .default([]),
  tasks: z
    .array(meetingSectionTaskSchema)
    .max(VALIDATION_LIMITS.tasksPerMeetingSectionMax)
    .default([]),
  agreements: z
    .array(meetingSectionAgreementSchema)
    .max(VALIDATION_LIMITS.agreementsPerMeetingSectionMax)
    .default([]),
  completedAt: isoDateTimeStringSchema.optional(),
});

export const meetingSchema = z.object({
  id: meetingIdSchema,
  templateId: meetingTemplateIdSchema,
  title: meetingTitleSchema,
  status: meetingStatusSchema,
  participantIds: z.array(apiIdSchema),
  sections: z
    .array(meetingSectionSchema)
    .max(VALIDATION_LIMITS.meetingSectionsPerMeetingMax),
  currentSectionIndex: z.number().int().min(0),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  completedAt: isoDateTimeStringSchema.optional(),
  aiSummary: meetingSummaryForMeetingSchema.optional(),
  serverRevision: serverRevisionSchema.optional(),
  deletedAt: isoDateTimeStringSchema.optional(),
});

export const meetingParamsSchema = z.object({
  id: meetingIdSchema,
});

export const meetingsResponseSchema = z.object({
  meetings: z.array(meetingSchema),
  activeMeetingId: meetingIdSchema.nullable(),
  draftSavedAt: isoDateTimeStringSchema.nullable(),
  syncedAt: isoDateTimeStringSchema,
});

export const syncMeetingsRequestSchema = z.object({
  meetings: z.array(meetingSchema).max(VALIDATION_LIMITS.meetingsPerSyncRequestMax),
  activeMeetingId: meetingIdSchema.nullable(),
  draftSavedAt: isoDateTimeStringSchema.nullable(),
  clientUpdatedAt: isoDateTimeStringSchema,
  lastSyncedAt: isoDateTimeStringSchema.optional(),
});

export const meetingSyncConflictSchema = createTypedSyncConflictSchema(
  'meeting',
  meetingSchema,
);

export const syncMeetingsResponseSchema = meetingsResponseSchema.extend({
  conflicts: z.array(meetingSyncConflictSchema),
});

export const saveMeetingSummaryRequestSchema = z.object({
  summary: meetingSummaryForMeetingSchema,
});

export type MeetingStatusDto = z.infer<typeof meetingStatusSchema>;
export type MeetingSectionNoteDto = z.infer<typeof meetingSectionNoteSchema>;
export type MeetingSectionTaskDto = z.infer<typeof meetingSectionTaskSchema>;
export type MeetingSectionAgreementDto = z.infer<
  typeof meetingSectionAgreementSchema
>;
export type MeetingSectionDto = z.infer<typeof meetingSectionSchema>;
export type MeetingDto = z.infer<typeof meetingSchema>;
export type MeetingsResponseDto = z.infer<typeof meetingsResponseSchema>;
export type SyncMeetingsRequestDto = z.infer<typeof syncMeetingsRequestSchema>;
export type SyncMeetingsResponseDto = z.infer<typeof syncMeetingsResponseSchema>;
