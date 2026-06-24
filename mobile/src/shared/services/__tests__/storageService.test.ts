import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import {
  clearAllLocalAppDataAfterAccountDeletion,
  migrateAppDataFromVersion4ToVersion5,
} from '@/shared/services/storageService';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    remove: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ value: null }),
  },
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const localStorageKeysToClear = [
  'ourweek:app-data',
  'ourweek:auth',
  'ourweek:calendar-sync-settings',
  'ourweek:meetings',
  'ourweek:participants',
  'ourweek:private-notes',
  'ourweek:reminder-settings',
  'ourweek:tasks-agreements',
  'ourweek:workspace',
  'ourweek:app-data:backup:manual:1',
  'ourweek:app-data:backup:before-sync-owner-change:2',
];

function createVersionFourData(sourceTasks: Record<string, unknown>[]) {
  const movedAt = '2026-06-22T10:05:00.000Z';
  const movedTask = {
    id: 'moved-task',
    title: 'Book the appointment',
    responsibilityType: 'needsDiscussion',
    responsibleParticipantIds: [],
    status: 'open',
    sourceMeetingId: 'current-meeting',
    createdAt: movedAt,
    updatedAt: movedAt,
  };

  return {
    appDataVersion: 4,
    tasks: {
      tasks: [...sourceTasks, movedTask],
      agreements: [],
      reviewDecisions: [
        {
          meetingId: 'current-meeting',
          sourceMeetingId: 'previous-meeting',
          decidedAt: '2026-06-22T10:05:00.001Z',
        },
      ],
    },
    meetings: {
      meetings: [
        {
          id: 'current-meeting',
          sections: [
            {
              id: 'tasks',
              tasks: [{ ...movedTask, sectionId: 'tasks' }],
            },
          ],
        },
      ],
    },
  };
}

beforeEach(() => {
  const storage = new MemoryStorage();

  for (const key of localStorageKeysToClear) {
    storage.setItem(key, JSON.stringify({ key }));
  }

  storage.setItem('unrelated:key', 'keep');
  vi.stubGlobal('window', { localStorage: storage });
  vi.mocked(Preferences.remove).mockClear();
});

describe('clearAllLocalAppDataAfterAccountDeletion', () => {
  it('removes current, legacy, backup, and settings storage only', async () => {
    const storage = window.localStorage;

    await clearAllLocalAppDataAfterAccountDeletion();

    for (const key of localStorageKeysToClear) {
      expect(storage.getItem(key), key).toBeNull();
    }

    expect(storage.getItem('unrelated:key')).toBe('keep');
    expect(Preferences.remove).toHaveBeenCalledWith({
      key: 'ourweek:settings',
    });
  });

  it('rejects when settings cleanup fails', async () => {
    vi.mocked(Preferences.remove).mockRejectedValueOnce(
      new Error('preferences blocked')
    );

    await expect(clearAllLocalAppDataAfterAccountDeletion()).rejects.toThrow(
      'storage.clearFailed'
    );
  });

  it('rejects when browser localStorage cannot be accessed', async () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('localStorage blocked');
      },
    });

    await expect(clearAllLocalAppDataAfterAccountDeletion()).rejects.toThrow(
      'storage.clearFailed'
    );
  });
});

describe('version 5 carried-task migration', () => {
  it('tags an unambiguous global and embedded carried task', () => {
    const migrated = migrateAppDataFromVersion4ToVersion5(
      createVersionFourData([
        {
          id: 'previous-task',
          title: 'Book the appointment',
          responsibilityType: 'needsDiscussion',
          responsibleParticipantIds: [],
          status: 'skipped',
          sourceMeetingId: 'previous-meeting',
          createdAt: '2026-06-15T10:00:00.000Z',
          updatedAt: '2026-06-22T10:05:00.000Z',
        },
      ])
    );

    expect(migrated).toMatchObject({
      appDataVersion: 5,
      tasks: {
        tasks: [
          { id: 'previous-task' },
          {
            id: 'moved-task',
            carriedFromTaskId: 'previous-task',
          },
        ],
      },
      meetings: {
        meetings: [
          {
            id: 'current-meeting',
            sections: [
              {
                tasks: [
                  {
                    id: 'moved-task',
                    carriedFromTaskId: 'previous-task',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  it('leaves ambiguous legacy tasks unchanged', () => {
    const duplicateSourceTask = {
      title: 'Book the appointment',
      responsibilityType: 'needsDiscussion',
      responsibleParticipantIds: [],
      status: 'skipped',
      sourceMeetingId: 'previous-meeting',
      createdAt: '2026-06-15T10:00:00.000Z',
      updatedAt: '2026-06-22T10:05:00.000Z',
    };
    const migrated = migrateAppDataFromVersion4ToVersion5(
      createVersionFourData([
        { ...duplicateSourceTask, id: 'previous-task-1' },
        { ...duplicateSourceTask, id: 'previous-task-2' },
      ])
    );
    const taskState = migrated.tasks as {
      tasks: Array<Record<string, unknown>>;
    };
    const meetingState = migrated.meetings as {
      meetings: Array<{
        sections: Array<{ tasks: Array<Record<string, unknown>> }>;
      }>;
    };

    expect(taskState.tasks.at(-1)).not.toHaveProperty('carriedFromTaskId');
    expect(meetingState.meetings[0].sections[0].tasks[0]).not.toHaveProperty(
      'carriedFromTaskId'
    );
  });

  it('preserves provenance that is already present', () => {
    const data = createVersionFourData([]);
    const taskState = data.tasks as {
      tasks: Array<Record<string, unknown>>;
    };
    const meetingState = data.meetings as {
      meetings: Array<{
        sections: Array<{ tasks: Array<Record<string, unknown>> }>;
      }>;
    };

    taskState.tasks[0].carriedFromTaskId = 'explicit-source-task';
    meetingState.meetings[0].sections[0].tasks[0].carriedFromTaskId =
      'explicit-source-task';

    expect(migrateAppDataFromVersion4ToVersion5(data)).toMatchObject({
      tasks: {
        tasks: [
          {
            id: 'moved-task',
            carriedFromTaskId: 'explicit-source-task',
          },
        ],
      },
      meetings: {
        meetings: [
          {
            sections: [
              {
                tasks: [
                  {
                    id: 'moved-task',
                    carriedFromTaskId: 'explicit-source-task',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });
});
