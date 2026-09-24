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

export const taskResponsibilityTypeSchema = z.enum([
  'participant',
  'shared',
  'needsDiscussion',
]);

export const taskStatusSchema = z.enum(['open', 'done', 'skipped']);

export const taskTitleSchema = trimmedString(
  VALIDATION_LIMITS.taskTitleMinLength,
  VALIDATION_LIMITS.taskTitleMaxLength,
);

export const taskDescriptionSchema = optionalTrimmedString(
  VALIDATION_LIMITS.taskDescriptionMaxLength,
);

export const agreementTitleSchema = trimmedString(
  VALIDATION_LIMITS.agreementTitleMinLength,
  VALIDATION_LIMITS.agreementTitleMaxLength,
);

export const agreementDescriptionSchema = optionalTrimmedString(
  VALIDATION_LIMITS.agreementDescriptionMaxLength,
);

export const taskSchema = z.object({
  id: apiIdSchema,
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  responsibilityType: taskResponsibilityTypeSchema,
  responsibleParticipantIds: z.array(apiIdSchema),
  responsibleUserIds: z.array(apiIdSchema).default([]),
  dueDate: isoDateStringSchema.optional(),
  status: taskStatusSchema,
  sourceMeetingId: apiIdSchema.optional(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  serverRevision: serverRevisionSchema.optional(),
  deletedAt: isoDateTimeStringSchema.optional(),
});

export const agreementSchema = z.object({
  id: apiIdSchema,
  title: agreementTitleSchema,
  description: agreementDescriptionSchema,
  participantIds: z.array(apiIdSchema),
  relatedTaskIds: z.array(apiIdSchema).optional(),
  sourceMeetingId: apiIdSchema,
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  serverRevision: serverRevisionSchema.optional(),
  deletedAt: isoDateTimeStringSchema.optional(),
});

export const taskReviewDecisionSchema = z.object({
  meetingId: apiIdSchema,
  sourceMeetingId: apiIdSchema,
  decidedAt: isoDateTimeStringSchema,
});

export const taskSyncConflictSchema = createTypedSyncConflictSchema(
  'task',
  taskSchema,
);
export const agreementSyncConflictSchema = createTypedSyncConflictSchema(
  'agreement',
  agreementSchema,
);
export const taskOrAgreementSyncConflictSchema = z.union([
  taskSyncConflictSchema,
  agreementSyncConflictSchema,
]);

export const syncTasksRequestSchema = z.object({
  tasks: z.array(taskSchema).max(VALIDATION_LIMITS.tasksPerSyncRequestMax),
  agreements: z
    .array(agreementSchema)
    .max(VALIDATION_LIMITS.agreementsPerSyncRequestMax),
  reviewDecisions: z.array(taskReviewDecisionSchema),
  clientUpdatedAt: isoDateTimeStringSchema,
  lastSyncedAt: isoDateTimeStringSchema.optional(),
});

export const tasksResponseSchema = z.object({
  tasks: z.array(taskSchema),
  agreements: z.array(agreementSchema),
  reviewDecisions: z.array(taskReviewDecisionSchema),
  conflicts: z.array(taskOrAgreementSyncConflictSchema),
  syncedAt: isoDateTimeStringSchema,
});

export const syncTasksResponseSchema = tasksResponseSchema;

export type TaskResponsibilityTypeDto = z.infer<
  typeof taskResponsibilityTypeSchema
>;
export type TaskStatusDto = z.infer<typeof taskStatusSchema>;
export type TaskDto = z.infer<typeof taskSchema>;
export type AgreementDto = z.infer<typeof agreementSchema>;
export type TaskReviewDecisionDto = z.infer<typeof taskReviewDecisionSchema>;
export type SyncTasksRequestDto = z.infer<typeof syncTasksRequestSchema>;
export type SyncTasksResponseDto = z.infer<typeof syncTasksResponseSchema>;

