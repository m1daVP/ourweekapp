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
import { formatApiDateTime, formatNullableApiDateTime } from '../src/shared/dates.js';
import { emailSchema, VALIDATION_LIMITS } from '../src/shared/schemas/index.js';

const now = '2026-06-04T12:00:00.000Z';
const participantId = '11111111-1111-4111-8111-111111111111';

function participantIdForIndex(index: number) {
  return `${index.toString(16).padStart(8, '0')}-0000-4000-8000-${index
    .toString(16)
    .padStart(12, '0')}`;
}

const participant = {
  id: participantId,
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
  responsibleParticipantIds: [participantId],
  status: 'open',
  createdAt: now,
  updatedAt: now,
} as const;

const agreement = {
  id: 'agreement_1',
  title: 'Review the school plan',
  participantIds: [participantId],
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
  it('normalizes API datetimes to canonical UTC strings', () => {
    expect(formatApiDateTime('2026-06-11T17:16:13.351+02:00'))
      .toBe('2026-06-11T15:16:13.351Z');
    expect(formatApiDateTime('2026-06-11T15:16:13.351Z'))
      .toBe('2026-06-11T15:16:13.351Z');
    expect(formatNullableApiDateTime(null)).toBeNull();
    expect(() => formatApiDateTime('not-a-date')).toThrow(
      'Invalid API datetime value.',
    );
  });

  it('trims and normalizes email before validating it', () => {
    expect(emailSchema.parse(' RITA@EXAMPLE.COM ')).toBe('rita@example.com');
  });

  it('enforces the participant sync item limit', () => {
    const request = {
      participants: Array.from(
        { length: VALIDATION_LIMITS.participantsPerWorkspaceMax + 1 },
        (_, index) => ({ ...participant, id: participantIdForIndex(index + 1) }),
      ),
      clientUpdatedAt: now,
    };

    expect(syncParticipantsRequestSchema.safeParse(request).success).toBe(false);
  });

  it('rejects non-UUID participant IDs', () => {
    const request = {
      participants: [{ ...participant, id: 'participant_1' }],
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
      templateId: 'weekly-family-check-in',
      title: 'Weekly check-in',
      status: 'draft',
      participantIds: [participantId],
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



