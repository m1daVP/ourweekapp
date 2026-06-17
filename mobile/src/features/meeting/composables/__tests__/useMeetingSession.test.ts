import { describe, expect, it } from 'vitest';
import {
  getMeetingRouteDecision,
  getMeetingDurationMinutes,
  getMeetingReviewCounts,
  normalizeCheckedInParticipantIds,
  chooseSelectedParticipantId,
  resolveTaskResponsibility,
} from '@/features/meeting/composables/useMeetingSession';
import type { Meeting } from '@/features/meeting/types';

function createMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    templateId: 'weekly-family-check-in',
    title: 'Weekly family check-in',
    status: 'draft',
    participantIds: ['participant-1'],
    sections: [
      {
        id: 'goodThings',
        title: 'Good things',
        prompt: 'What went well this week?',
        notes: [],
        tasks: [],
        agreements: [],
      },
    ],
    currentSectionIndex: 0,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('meeting session helpers', () => {
  it('keeps viewers in read-only mode when no meeting is active', () => {
    expect(getMeetingRouteDecision(false, null, [])).toEqual({
      type: 'readonly',
    });
  });

  it('resumes the active unfinished meeting before looking for other drafts', () => {
    const activeMeeting = createMeeting({ id: 'active-meeting' });
    const otherDraft = createMeeting({ id: 'other-draft' });

    expect(getMeetingRouteDecision(true, activeMeeting, [otherDraft])).toEqual({
      type: 'resume',
      meetingId: 'active-meeting',
    });
  });

  it('sends creators to templates when there is no unfinished meeting', () => {
    const completedMeeting = createMeeting({
      id: 'completed-meeting',
      status: 'completed',
    });

    expect(getMeetingRouteDecision(true, null, [completedMeeting])).toEqual({
      type: 'templates',
    });
  });

  it('normalizes checked-in participants to available ids and falls back safely', () => {
    expect(
      normalizeCheckedInParticipantIds(
        ['participant-1', 'participant-2'],
        ['missing-participant']
      )
    ).toEqual(['participant-1', 'participant-2']);

    expect(
      normalizeCheckedInParticipantIds(
        ['participant-1', 'participant-2', 'participant-3'],
        ['participant-2', 'missing-participant'],
        1
      )
    ).toEqual(['participant-2']);
  });

  it('chooses a valid active participant when the current selection is stale', () => {
    expect(
      chooseSelectedParticipantId('missing-participant', [
        'participant-1',
        'participant-2',
      ])
    ).toBe('participant-1');

    expect(
      chooseSelectedParticipantId('participant-2', [
        'participant-1',
        'participant-2',
      ])
    ).toBe('participant-2');
  });

  it('resolves task responsibility without accepting stale participant ids', () => {
    expect(resolveTaskResponsibility('shared', ['participant-1'])).toEqual({
      responsibilityType: 'shared',
      responsibleParticipantIds: ['participant-1'],
    });

    expect(
      resolveTaskResponsibility('participant-1', ['participant-1'])
    ).toEqual({
      responsibilityType: 'participant',
      responsibleParticipantIds: ['participant-1'],
    });

    expect(resolveTaskResponsibility('missing-participant', [])).toEqual({
      responsibilityType: 'needsDiscussion',
      responsibleParticipantIds: [],
    });
  });

  it('counts only real meeting content for final review state', () => {
    const meeting = createMeeting({
      sections: [
        {
          id: 'tasks',
          title: 'Tasks',
          prompt: 'What needs to be handled?',
          notes: [
            {
              id: 'note-1',
              sectionId: 'tasks',
              participantId: 'participant-1',
              text: 'Pack the school form.',
              createdAt: '2026-06-01T10:01:00.000Z',
            },
          ],
          tasks: [
            {
              id: 'task-1',
              sectionId: 'tasks',
              title: 'Send the form',
              responsibilityType: 'participant',
              responsibleParticipantIds: ['participant-1'],
              status: 'open',
              createdAt: '2026-06-01T10:02:00.000Z',
              updatedAt: '2026-06-01T10:02:00.000Z',
            },
          ],
          agreements: [
            {
              id: 'agreement-1',
              sectionId: 'tasks',
              text: 'Forms are checked on Sunday.',
              participantIds: ['participant-1'],
              createdAt: '2026-06-01T10:03:00.000Z',
            },
          ],
        },
      ],
    });

    expect(getMeetingReviewCounts(meeting)).toEqual({
      notes: 1,
      tasks: 1,
      agreements: 1,
      hasContent: true,
    });

    expect(getMeetingReviewCounts(null)).toEqual({
      notes: 0,
      tasks: 0,
      agreements: 0,
      hasContent: false,
    });
  });

  it('calculates meeting duration from real timestamps without negative values', () => {
    expect(
      getMeetingDurationMinutes(
        createMeeting({
          createdAt: '2026-06-01T10:00:00.000Z',
          completedAt: '2026-06-01T10:15:20.000Z',
        })
      )
    ).toBe(15);

    expect(
      getMeetingDurationMinutes(
        createMeeting({
          createdAt: '2026-06-01T10:00:00.000Z',
        }),
        new Date('2026-06-01T10:04:35.000Z').getTime()
      )
    ).toBe(5);

    expect(
      getMeetingDurationMinutes(
        createMeeting({
          createdAt: 'not-a-date',
        })
      )
    ).toBe(0);
  });
});
