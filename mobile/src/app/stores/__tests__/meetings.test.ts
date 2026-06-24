import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMeetingsStore } from '@/app/stores/meetings';
import type { Meeting } from '@/features/meeting/types';

const storageMocks = vi.hoisted(() => ({
  writeStorageSlice: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: (_key: string, fallback: unknown) => fallback,
  writeStorageSlice: storageMocks.writeStorageSlice,
}));

const createdAt = '2026-06-22T10:00:00.000Z';

function createMeeting(status: Meeting['status'] = 'in_progress'): Meeting {
  return {
    id: 'meeting-1',
    templateId: 'weekly-family-check-in',
    title: 'Weekly family check-in',
    status,
    participantIds: ['participant-1', 'participant-2'],
    sections: [
      {
        id: 'goodThings',
        title: 'Good things',
        prompt: 'What went well?',
        notes: [
          {
            id: 'note-1',
            sectionId: 'goodThings',
            participantId: 'participant-1',
            text: 'Original note',
            createdAt,
          },
        ],
        tasks: [],
        agreements: [],
      },
    ],
    currentSectionIndex: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

function setMeeting(status: Meeting['status'] = 'in_progress') {
  const meetingsStore = useMeetingsStore();
  const meeting = createMeeting(status);
  meetingsStore.meetings = [meeting];
  meetingsStore.activeMeetingId = meeting.id;
  return { meeting, meetingsStore };
}

beforeEach(() => {
  setActivePinia(createPinia());
  storageMocks.writeStorageSlice.mockReset();
});

describe('meetings store note editing', () => {
  it('updates and trims the note text and changes its author', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T10:05:00.000Z'));
    const { meeting, meetingsStore } = setMeeting();

    const error = meetingsStore.updateNote(
      'note-1',
      'participant-2',
      '  Corrected note  '
    );

    expect(error).toBeNull();
    expect(meeting.sections[0].notes[0]).toMatchObject({
      participantId: 'participant-2',
      text: 'Corrected note',
      createdAt,
    });
    expect(meeting.updatedAt).toBe('2026-06-22T10:05:00.000Z');
    expect(storageMocks.writeStorageSlice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it.each([
    {
      name: 'empty text',
      noteId: 'note-1',
      participantId: 'participant-2',
      text: '   ',
      expectedError: 'meetingStore.addShortNote',
    },
    {
      name: 'an author outside the meeting',
      noteId: 'note-1',
      participantId: 'participant-3',
      text: 'Corrected note',
      expectedError: 'meetingStore.chooseNoteAuthor',
    },
    {
      name: 'a missing note',
      noteId: 'missing-note',
      participantId: 'participant-2',
      text: 'Corrected note',
      expectedError: 'meetingStore.noteNotFound',
    },
  ])('rejects $name without changing or persisting data', (scenario) => {
    const { meeting, meetingsStore } = setMeeting();
    const originalMeeting = structuredClone(meeting);

    expect(
      meetingsStore.updateNote(
        scenario.noteId,
        scenario.participantId,
        scenario.text
      )
    ).toBe(scenario.expectedError);
    expect(meeting).toEqual(originalMeeting);
    expect(storageMocks.writeStorageSlice).not.toHaveBeenCalled();
  });

  it('does not edit notes in a completed meeting', () => {
    const { meeting, meetingsStore } = setMeeting('completed');
    const originalMeeting = structuredClone(meeting);

    expect(
      meetingsStore.updateNote('note-1', 'participant-2', 'Corrected note')
    ).toBe('meetingStore.noteNotEditable');
    expect(meeting).toEqual(originalMeeting);
    expect(storageMocks.writeStorageSlice).not.toHaveBeenCalled();
  });
});
