import { describe, expect, it } from 'vitest';
import { getAiRecapContentReadiness } from '../aiRecapContentReadiness';
import { meetingFixture } from './recapFixtures';

describe('getAiRecapContentReadiness', () => {
  it('accepts shared discussion in two sections', () => {
    const meeting = meetingFixture(false);

    expect(getAiRecapContentReadiness(meeting)).toEqual({
      isReady: true,
      discussionSignalCount: 2,
      sectionCount: 2,
    });
  });

  it('does not count tasks or multiple notes in one section as sufficient context', () => {
    const meeting = meetingFixture(false);
    meeting.sections = [meeting.sections[0]!];
    meeting.sections[0]!.notes.push({
      id: 'note-2',
      sectionId: 'goodThings',
      participantId: 'participant-1',
      text: 'Book the dentist.',
      createdAt: '2026-09-04T10:00:00.000Z',
    });
    meeting.sections[0]!.tasks.push({
      id: 'task-1',
      sectionId: 'goodThings',
      title: 'Buy groceries',
      responsibilityType: 'shared',
      responsibleParticipantIds: [],
      status: 'open',
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    });

    expect(getAiRecapContentReadiness(meeting)).toEqual({
      isReady: false,
      discussionSignalCount: 2,
      sectionCount: 1,
    });
  });
});
