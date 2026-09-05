import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTasksStore } from '@/app/stores/tasks';

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

beforeEach(() => {
  setActivePinia(createPinia());
  storageMocks.writeStorageSlice.mockReset();
});

describe('tasks store carry-forward flow', () => {
  it('keeps a moved copy active for the new meeting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T10:05:00.000Z'));
    const tasksStore = useTasksStore();

    tasksStore.tasks = [
      {
        id: 'previous-task',
        title: 'Book the appointment',
        responsibilityType: 'needsDiscussion',
        responsibleParticipantIds: [],
        status: 'open',
        sourceMeetingId: 'previous-meeting',
        createdAt: '2026-06-15T10:00:00.000Z',
        updatedAt: '2026-06-15T10:00:00.000Z',
      },
      {
        id: 'unrelated-task',
        title: 'Unrelated active task',
        responsibilityType: 'needsDiscussion',
        responsibleParticipantIds: [],
        status: 'open',
        sourceMeetingId: 'unrelated-meeting',
        createdAt: '2026-06-16T10:00:00.000Z',
        updatedAt: '2026-06-16T10:00:00.000Z',
      },
    ];

    const movedTasks = tasksStore.moveOpenTasksToMeeting(
      'previous-meeting',
      'current-meeting'
    );

    expect(movedTasks).toHaveLength(1);
    expect(movedTasks[0]).toMatchObject({
      title: 'Book the appointment',
      status: 'open',
      sourceMeetingId: 'current-meeting',
      carriedFromTaskId: 'previous-task',
      createdAt: '2026-06-22T10:05:00.000Z',
    });
    expect(
      tasksStore.tasks.find((task) => task.id === 'previous-task')
    ).toMatchObject({
      status: 'skipped',
      updatedAt: '2026-06-22T10:05:00.000Z',
    });
    expect(
      tasksStore.tasks.find((task) => task.id === 'unrelated-task')
    ).toMatchObject({
      status: 'open',
      sourceMeetingId: 'unrelated-meeting',
    });
    expect(storageMocks.writeStorageSlice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('tasks store responsibility updates', () => {
  it('preserves adult assignments when the responsibility payload omits them', () => {
    const tasksStore = useTasksStore();

    tasksStore.addTask({
      id: 'task-1',
      title: 'Buy fruit',
      responsibilityType: 'shared',
      responsibleParticipantIds: ['participant-1'],
      responsibleUserIds: ['adult-1'],
    });

    tasksStore.updateTask('task-1', {
      responsibilityType: 'participant',
      responsibleParticipantIds: ['participant-2'],
    });

    expect(tasksStore.tasks[0]).toMatchObject({
      responsibilityType: 'participant',
      responsibleParticipantIds: ['participant-2'],
      responsibleUserIds: ['adult-1'],
    });
  });
});
