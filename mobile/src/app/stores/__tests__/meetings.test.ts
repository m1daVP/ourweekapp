import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useTasksStore } from '@/app/stores/tasks';
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
    checkInCompleted: false,
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
        tasks: [
          {
            id: 'task-1',
            sectionId: 'goodThings',
            title: 'Buy school shoes',
            responsibilityType: 'participant',
            responsibleParticipantIds: ['participant-1'],
            status: 'open',
            createdAt,
            updatedAt: createdAt,
          },
        ],
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
  it('preserves selected attendees while changing the check-in phase or resuming', () => {
    const { meeting, meetingsStore } = setMeeting();
    meeting.participantIds.push('participant-3');

    meetingsStore.setCheckInCompleted(true);
    meetingsStore.resumeMeeting(meeting.id);

    expect(meeting).toMatchObject({
      checkInCompleted: true,
      participantIds: ['participant-1', 'participant-2', 'participant-3'],
    });

    meetingsStore.setCheckInCompleted(false);

    expect(meeting).toMatchObject({
      checkInCompleted: false,
      participantIds: ['participant-1', 'participant-2', 'participant-3'],
    });
  });

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

  it('deletes a note and returns a restorable snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T10:05:00.000Z'));
    const { meeting, meetingsStore } = setMeeting();

    const snapshot = meetingsStore.deleteNote('note-1');

    expect(snapshot).toMatchObject({
      meetingId: 'meeting-1',
      sectionId: 'goodThings',
      sectionIndex: 0,
      note: {
        id: 'note-1',
        text: 'Original note',
      },
    });
    expect(meeting.sections[0].notes).toEqual([]);
    expect(meeting.updatedAt).toBe('2026-06-22T10:05:00.000Z');
    expect(storageMocks.writeStorageSlice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('restores a deleted note at its original section index', () => {
    const { meeting, meetingsStore } = setMeeting();
    meeting.sections[0].notes.push({
      id: 'note-2',
      sectionId: 'goodThings',
      participantId: 'participant-2',
      text: 'Second note',
      createdAt,
    });

    const snapshot = meetingsStore.deleteNote('note-1');

    expect(snapshot).not.toBeNull();
    expect(meetingsStore.restoreNote(snapshot!)).toBe(true);
    expect(meeting.sections[0].notes.map((note) => note.id)).toEqual([
      'note-1',
      'note-2',
    ]);
    expect(storageMocks.writeStorageSlice).toHaveBeenCalledTimes(2);
  });

  it('does not delete or restore notes in a completed meeting', () => {
    const { meeting, meetingsStore } = setMeeting('completed');
    const originalMeeting = structuredClone(meeting);

    expect(meetingsStore.deleteNote('note-1')).toBeNull();
    expect(
      meetingsStore.restoreNote({
        meetingId: meeting.id,
        note: {
          id: 'note-2',
          sectionId: 'goodThings',
          participantId: 'participant-1',
          text: 'Restored note',
          createdAt,
        },
        sectionId: 'goodThings',
        sectionIndex: 0,
      })
    ).toBe(false);
    expect(meeting).toEqual(originalMeeting);
    expect(storageMocks.writeStorageSlice).not.toHaveBeenCalled();
  });

  it('deletes and restores a meeting task with the shared task store', () => {
    const { meeting, meetingsStore } = setMeeting();
    const tasksStore = useTasksStore();
    tasksStore.addTask({
      id: 'task-1',
      title: 'Buy school shoes',
      responsibilityType: 'participant',
      responsibleParticipantIds: ['participant-1'],
      status: 'open',
      sourceMeetingId: meeting.id,
      createdAt,
      updatedAt: createdAt,
    });
    storageMocks.writeStorageSlice.mockClear();

    const snapshot = meetingsStore.deleteTask('task-1');

    expect(snapshot).toMatchObject({
      meetingId: 'meeting-1',
      sectionId: 'goodThings',
      sectionIndex: 0,
      task: {
        id: 'task-1',
        title: 'Buy school shoes',
      },
    });
    expect(meeting.sections[0].tasks).toEqual([]);
    expect(tasksStore.tasks[0]).toMatchObject({
      id: 'task-1',
      deletedAt: expect.any(String),
    });

    expect(meetingsStore.restoreTask(snapshot!)).toBe(true);
    expect(meeting.sections[0].tasks.map((task) => task.id)).toEqual([
      'task-1',
    ]);
    expect(tasksStore.tasks[0]).toMatchObject({
      id: 'task-1',
      sourceMeetingId: 'meeting-1',
    });
    expect(tasksStore.tasks[0].deletedAt).toBeUndefined();
  });

  it('does not delete or restore tasks in a completed meeting', () => {
    const { meeting, meetingsStore } = setMeeting('completed');
    const originalMeeting = structuredClone(meeting);

    expect(meetingsStore.deleteTask('task-1')).toBeNull();
    expect(
      meetingsStore.restoreTask({
        meetingId: meeting.id,
        sectionId: 'goodThings',
        sectionIndex: 0,
        task: {
          id: 'task-2',
          sectionId: 'goodThings',
          title: 'Restored task',
          responsibilityType: 'needsDiscussion',
          responsibleParticipantIds: [],
          status: 'open',
          createdAt,
          updatedAt: createdAt,
        },
      })
    ).toBe(false);
    expect(meeting).toEqual(originalMeeting);
    expect(storageMocks.writeStorageSlice).not.toHaveBeenCalled();
  });
});

describe('meetings store task editing', () => {
  it('preserves adult assignments when the responsibility payload omits them', () => {
    const { meeting, meetingsStore } = setMeeting();
    meeting.sections[0].tasks[0].responsibleUserIds = ['adult-1'];

    meetingsStore.updateTaskDetails('task-1', {
      responsibilityType: 'shared',
      responsibleParticipantIds: ['participant-1', 'participant-2'],
    });

    expect(meeting.sections[0].tasks[0]).toMatchObject({
      responsibilityType: 'shared',
      responsibleParticipantIds: ['participant-1', 'participant-2'],
      responsibleUserIds: ['adult-1'],
    });
  });
});
