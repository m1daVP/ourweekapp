import { describe, expect, it } from 'vitest';

import { authUserSchema } from '../src/modules/auth/auth.schema.js';
import { meetingSchema, meetingSyncConflictSchema } from '../src/modules/meetings/meetings.schema.js';
import {
  participantSyncConflictSchema,
  syncParticipantsRequestSchema,
} from '../src/modules/participants/participants.schema.js';
import {
  agreementSyncConflictSchema,
  syncTasksRequestSchema,
  taskSyncConflictSchema,
} from '../src/modules/tasks/tasks.schema.js';
import { emailSchema, VALIDATION_LIMITS } from '../src/shared/schemas/index.js';

const now = '2026-06-04T12:00:00.000Z';

const participant = {
  id: 'participant_1',
  name: 'Rita',
  initials: 'R',
  avatarColor: '#7A8C6B',
  type: 'adult',
  isActive: true,
  createdAt: now,
  updatedAt: now,
} as const;

const task = {
  id: 'task_1',
  title: 'Buy shoes',
  responsibilityType: 'participant',
  responsibleParticipantIds: ['participant_1'],
  status: 'open',
  createdAt: now,
  updatedAt: now,
} as const;

const agreement = {
  id: 'agreement_1',
  title: 'Review the school plan',
  participantIds: ['participant_1'],
  sourceMeetingId: 'meeting_1',
  createdAt: now,
  updatedAt: now,
} as const;

const conflictBase = {
  resourceId: 'resource_1',
  reason: 'updated_on_client_and_server',
  detectedAt: now,
} as const;

describe('DTO schema validation limits', () => {
  it('trims and normalizes email before validating it', () => {
    expect(emailSchema.parse(' RITA@EXAMPLE.COM ')).toBe('rita@example.com');
  });

  it('enforces the participant sync item limit', () => {
    const request = {
      participants: Array.from(
        { length: VALIDATION_LIMITS.participantsPerWorkspaceMax + 1 },
        (_, index) => ({ ...participant, id: `participant_${index}` }),
      ),
      clientUpdatedAt: now,
    };

    expect(syncParticipantsRequestSchema.safeParse(request).success).toBe(false);
  });

  it('enforces task and agreement sync limits', () => {
    const request = {
      tasks: Array.from(
        { length: VALIDATION_LIMITS.tasksPerSyncRequestMax + 1 },
        (_, index) => ({ ...task, id: `task_${index}` }),
      ),
      agreements: Array.from(
        { length: VALIDATION_LIMITS.agreementsPerSyncRequestMax + 1 },
        (_, index) => ({ ...agreement, id: `agreement_${index}` }),
      ),
      reviewDecisions: [],
      clientUpdatedAt: now,
    };

    expect(syncTasksRequestSchema.safeParse(request).success).toBe(false);
  });

  it('requires typed sync conflict resourceType values', () => {
    const conflictSchemas = [
      {
        schema: participantSyncConflictSchema,
        resourceType: 'participant',
        wrongResourceType: 'meeting',
      },
      {
        schema: meetingSyncConflictSchema,
        resourceType: 'meeting',
        wrongResourceType: 'participant',
      },
      {
        schema: taskSyncConflictSchema,
        resourceType: 'task',
        wrongResourceType: 'agreement',
      },
      {
        schema: agreementSyncConflictSchema,
        resourceType: 'agreement',
        wrongResourceType: 'task',
      },
    ] as const;

    for (const { schema, resourceType, wrongResourceType } of conflictSchemas) {
      expect(
        schema.safeParse({ ...conflictBase, resourceType }).success,
      ).toBe(true);
      expect(
        schema.safeParse({ ...conflictBase, resourceType: wrongResourceType })
          .success,
      ).toBe(false);
    }
  });

  it('rejects empty meeting note text after trimming', () => {
    const meeting = {
      id: 'meeting_1',
      templateId: 'default',
      title: 'Weekly check-in',
      status: 'draft',
      participantIds: ['participant_1'],
      sections: [
        {
          id: 'section_1',
          notes: [{ id: 'note_1', text: '   ' }],
          tasks: [],
          agreements: [],
        },
      ],
      currentSectionIndex: 0,
      createdAt: now,
      updatedAt: now,
    };

    expect(meetingSchema.safeParse(meeting).success).toBe(false);
  });

  it('strips fields that are not part of safe API DTOs', () => {
    const parsedUser = authUserSchema.parse({
      id: 'user_1',
      email: ' RITA@EXAMPLE.COM ',
      displayName: 'Rita',
      role: 'owner',
      planType: 'free',
      createdAt: now,
      updatedAt: now,
      passwordHash: 'secret',
      refreshTokenHash: 'secret',
    });

    expect(parsedUser.email).toBe('rita@example.com');
    expect(parsedUser).not.toHaveProperty('passwordHash');
    expect(parsedUser).not.toHaveProperty('refreshTokenHash');
  });
});
