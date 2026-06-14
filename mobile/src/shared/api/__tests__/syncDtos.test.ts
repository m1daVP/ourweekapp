import { describe, expect, it } from 'vitest';
import {
  fromAgreementDto,
  fromMeetingDto,
  fromParticipantDto,
  fromTaskDto,
  toAgreementDto,
  toMeetingDto,
  toParticipantDto,
  toReviewDecisionDto,
  toTaskDto,
} from '@/shared/api/syncDtos';
import type { Meeting } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import type { Agreement, Task } from '@/features/tasks/types';

const createdAt = '2026-06-13T12:00:00.000Z';
const updatedAt = '2026-06-13T12:05:00.000Z';
const deletedAt = '2026-06-13T12:10:00.000Z';

describe('sync DTO mapping', () => {
  it('maps meeting sync metadata without dropping OpenAPI required fields', () => {
    const meeting: Meeting = {
      id: 'meeting-1',
      templateId: 'weekly-family-check-in',
      title: 'Weekly family check-in',
      status: 'draft',
      participantIds: ['participant-1'],
      sections: [],
      currentSectionIndex: 0,
      createdAt,
      updatedAt,
      serverRevision: 3,
      deletedAt,
    };

    const dto = toMeetingDto(meeting);

    expect(dto).toMatchObject({
      id: 'meeting-1',
      templateId: 'weekly-family-check-in',
      title: 'Weekly family check-in',
      status: 'draft',
      participantIds: ['participant-1'],
      sections: [],
      currentSectionIndex: 0,
      createdAt,
      updatedAt,
      serverRevision: 3,
      deletedAt,
    });
    expect(fromMeetingDto(dto)).toEqual(dto);
  });

  it('maps task, agreement, participant, and review decision DTOs', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Buy shoes',
      description: undefined,
      responsibilityType: 'participant',
      responsibleParticipantIds: ['participant-1'],
      dueDate: '2026-06-20',
      status: 'open',
      sourceMeetingId: 'meeting-1',
      createdAt,
      updatedAt,
      serverRevision: 4,
      deletedAt,
    };
    const agreement: Agreement = {
      id: 'agreement-1',
      title: 'Prepare clothes in the evening',
      description: undefined,
      participantIds: ['participant-1', 'participant-2'],
      relatedTaskIds: ['task-1'],
      sourceMeetingId: 'meeting-1',
      createdAt,
      updatedAt,
      serverRevision: 5,
      deletedAt,
    };
    const participant: Participant = {
      id: 'participant-1',
      name: 'Rita',
      initials: 'R',
      avatarColor: '#496a8f',
      type: 'adult',
      isActive: true,
      createdAt,
      updatedAt,
      serverRevision: 6,
      deletedAt,
    };

    expect(fromTaskDto(toTaskDto(task))).toEqual(task);
    expect(fromAgreementDto(toAgreementDto(agreement))).toEqual(agreement);
    expect(fromParticipantDto(toParticipantDto(participant))).toEqual(
      participant
    );
    expect(
      toReviewDecisionDto({
        meetingId: 'meeting-2',
        sourceMeetingId: 'meeting-1',
        decidedAt: updatedAt,
      })
    ).toEqual({
      meetingId: 'meeting-2',
      sourceMeetingId: 'meeting-1',
      decidedAt: updatedAt,
    });
  });
});
