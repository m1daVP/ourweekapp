import { describe, expect, it } from 'vitest';
import {
  createSavedMeetingSectionViewModel,
  splitSavedMeetingSections,
  type SavedMeetingFormatters,
} from '../savedMeetingSummary';
import type {
  MeetingNote,
  MeetingSection,
  MeetingSectionId,
  MeetingTask,
} from '../types';

const formatters: SavedMeetingFormatters = {
  formatNoteDate: () => 'Sep 16, 19:04',
  getParticipantName: (participantId) =>
    participantId === 'participant-rita' ? 'Rita' : 'Shared',
  getTaskStatusLabel: () => 'Open',
  getTaskResponsibleLabel: () => 'Needs discussion',
  formatDueDate: () => 'Sep 20',
};

function sectionFixture(id: MeetingSectionId): MeetingSection {
  return {
    id,
    title: id,
    prompt: `${id} prompt`,
    notes: [],
    tasks: [],
    agreements: [],
  };
}

function noteFixture(): MeetingNote {
  return {
    id: 'note-1',
    sectionId: 'finalAgreements',
    participantId: 'participant-rita',
    text: 'A saved note',
    createdAt: '2026-09-16T17:04:00.000Z',
  };
}

function taskFixture(): MeetingTask {
  return {
    id: 'task-1',
    sectionId: 'finalAgreements',
    title: 'Book the appointment',
    responsibilityType: 'needsDiscussion',
    responsibleParticipantIds: [],
    description: 'Bring the documents with you.',
    dueDate: '2026-09-20',
    status: 'open',
    createdAt: '2026-09-16T17:04:00.000Z',
    updatedAt: '2026-09-16T17:04:00.000Z',
  };
}

describe('saved meeting summary presentation', () => {
  it('separates final agreements from regular sections without changing order', () => {
    const result = splitSavedMeetingSections([
      sectionFixture('goodThings'),
      sectionFixture('finalAgreements'),
      sectionFixture('plans'),
    ]);

    expect(result.regularSections.map((section) => section.id)).toEqual([
      'goodThings',
      'plans',
    ]);
    expect(result.finalSection?.id).toBe('finalAgreements');
  });

  it('returns no final card when the template has no final agreements section', () => {
    const result = splitSavedMeetingSections([sectionFixture('goodThings')]);

    expect(result.finalSection).toBeNull();
  });

  it('marks an empty section empty and emits no item groups', () => {
    const viewModel = createSavedMeetingSectionViewModel(
      sectionFixture('goodThings'),
      formatters
    );

    expect(viewModel.status).toBe('empty');
    expect(viewModel.groups).toEqual([]);
  });

  it('normalizes saved rows and omits empty categories', () => {
    const section = sectionFixture('finalAgreements');
    section.notes.push(noteFixture());
    section.tasks.push(taskFixture());

    const viewModel = createSavedMeetingSectionViewModel(section, formatters);

    expect(viewModel.status).toBe('filled');
    expect(viewModel.groups.map((group) => group.kind)).toEqual([
      'notes',
      'tasks',
    ]);
    expect(viewModel.groups[0]?.rows[0]).toMatchObject({
      leadingMeta: 'Rita',
      trailingMeta: 'Sep 16, 19:04',
      title: 'A saved note',
    });
    expect(viewModel.groups[1]?.rows[0]).toMatchObject({
      title: 'Book the appointment',
      detail: 'Bring the documents with you.',
      leadingMeta: 'Needs discussion',
      trailingMeta: 'Sep 20',
      badge: 'Open',
    });
  });
});
