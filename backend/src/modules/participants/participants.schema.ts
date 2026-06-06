import { z } from 'zod';

import {
  apiIdSchema,
  avatarColorSchema,
  createTypedSyncConflictSchema,
  isoDateTimeStringSchema,
  serverRevisionSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';

export const participantTypeSchema = z.enum(['adult', 'child', 'other']);

export const participantNameSchema = trimmedString(
  VALIDATION_LIMITS.participantNameMinLength,
  VALIDATION_LIMITS.participantNameMaxLength,
);

export const participantInitialsSchema = trimmedString(
  VALIDATION_LIMITS.participantInitialsMinLength,
  VALIDATION_LIMITS.participantInitialsMaxLength,
);

export const participantSchema = z.object({
  id: apiIdSchema,
  name: participantNameSchema,
  initials: participantInitialsSchema,
  avatarColor: avatarColorSchema,
  type: participantTypeSchema,
  isActive: z.boolean(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  serverRevision: serverRevisionSchema.optional(),
  deletedAt: isoDateTimeStringSchema.optional(),
});

export const syncParticipantsRequestSchema = z.object({
  participants: z
    .array(participantSchema)
    .max(VALIDATION_LIMITS.participantsPerWorkspaceMax),
  clientUpdatedAt: isoDateTimeStringSchema,
  lastSyncedAt: isoDateTimeStringSchema.optional(),
});

export const participantSyncConflictSchema = createTypedSyncConflictSchema(
  'participant',
  participantSchema,
);

export const syncParticipantsResponseSchema = z.object({
  participants: z.array(participantSchema),
  conflicts: z.array(participantSyncConflictSchema),
  syncedAt: isoDateTimeStringSchema,
});

export type ParticipantTypeDto = z.infer<typeof participantTypeSchema>;
export type ParticipantDto = z.infer<typeof participantSchema>;
export type SyncParticipantsRequestDto = z.infer<
  typeof syncParticipantsRequestSchema
>;
export type SyncParticipantsResponseDto = z.infer<
  typeof syncParticipantsResponseSchema
>;

