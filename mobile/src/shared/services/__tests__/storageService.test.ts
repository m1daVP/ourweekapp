import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { clearAllLocalAppDataAfterAccountDeletion } from '@/shared/services/storageService';

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
