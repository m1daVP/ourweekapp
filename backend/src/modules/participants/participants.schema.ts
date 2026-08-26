import { z } from 'zod';

import {
  avatarColorSchema,
  createTypedSyncConflictSchema,
  isoDateTimeStringSchema,
  serverRevisionSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';

export const participantIdSchema = z.uuid();

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
  id: participantIdSchema,
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
    .max(VALIDATION_LIMITS.participantsPerWorkspaceMax)
    .superRefine((participants, ctx) => {
      const seenIds = new Set<string>();

      participants.forEach((participant, index) => {
        if (seenIds.has(participant.id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Participant IDs must be unique.',
            path: [index, 'id'],
          });
        }

        seenIds.add(participant.id);
      });
    }),
  clientUpdatedAt: isoDateTimeStringSchema,
  lastSyncedAt: isoDateTimeStringSchema.optional(),
});

export const participantSyncConflictSchema = createTypedSyncConflictSchema(
  'participant',
  participantSchema,
);

export const listParticipantsResponseSchema = z.object({
  participants: z.array(participantSchema),
});

export const syncParticipantsResponseSchema = z.object({
  participants: z.array(participantSchema),
  conflicts: z.array(participantSyncConflictSchema),
  syncedAt: isoDateTimeStringSchema,
});

export type ParticipantTypeDto = z.infer<typeof participantTypeSchema>;
export type ParticipantDto = z.infer<typeof participantSchema>;
export type ListParticipantsResponseDto = z.infer<
  typeof listParticipantsResponseSchema
>;
export type SyncParticipantsRequestDto = z.infer<
  typeof syncParticipantsRequestSchema
>;
export type SyncParticipantsResponseDto = z.infer<
  typeof syncParticipantsResponseSchema
>;

