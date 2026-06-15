import { describe, expect, it, vi } from 'vitest';
import {
  AccountDeletionCleanupError,
  deleteAccountAndClearLocalData,
} from '@/features/auth/accountDeletionLifecycle';

describe('deleteAccountAndClearLocalData', () => {
  it('deletes the backend account before clearing local data and session', async () => {
    const calls: string[] = [];
    const deleteBackendAccount = vi.fn(async () => {
      calls.push('deleteBackendAccount');
    });
    const clearSession = vi.fn(async () => {
      calls.push('clearSession');
    });
    const cancelLocalReminders = vi.fn(async () => {
      calls.push('cancelLocalReminders');
    });
    const clearLocalAppData = vi.fn(async () => {
      calls.push('clearLocalAppData');
    });
    const resetInMemoryStores = vi.fn(() => {
      calls.push('resetInMemoryStores');
    });

    await deleteAccountAndClearLocalData({
      deleteBackendAccount,
      clearSession,
      cancelLocalReminders,
      clearLocalAppData,
      resetInMemoryStores,
    });

    expect(calls).toEqual([
      'deleteBackendAccount',
      'cancelLocalReminders',
      'clearLocalAppData',
      'resetInMemoryStores',
      'clearSession',
    ]);
  });

  it('still clears local app data if reminder cancellation fails', async () => {
    const clearLocalAppData = vi.fn().mockResolvedValue(undefined);
    const resetInMemoryStores = vi.fn();
    const onReminderCancelError = vi.fn();
    const reminderError = new Error('notifications unavailable');

    await deleteAccountAndClearLocalData({
      deleteBackendAccount: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn().mockResolvedValue(undefined),
      cancelLocalReminders: vi.fn().mockRejectedValue(reminderError),
      clearLocalAppData,
      resetInMemoryStores,
      onReminderCancelError,
    });

    expect(onReminderCancelError).toHaveBeenCalledWith(reminderError);
    expect(clearLocalAppData).toHaveBeenCalled();
    expect(resetInMemoryStores).toHaveBeenCalled();
  });

  it('clears session and throws a typed error when local cleanup fails', async () => {
    const calls: string[] = [];
    const cleanupError = new Error('storage blocked');
    const clearSession = vi.fn(async () => {
      calls.push('clearSession');
    });
    const resetInMemoryStores = vi.fn(() => {
      calls.push('resetInMemoryStores');
    });

    await expect(
      deleteAccountAndClearLocalData({
        deleteBackendAccount: vi.fn(async () => {
          calls.push('deleteBackendAccount');
        }),
        clearSession,
        cancelLocalReminders: vi.fn(async () => {
          calls.push('cancelLocalReminders');
        }),
        clearLocalAppData: vi.fn(async () => {
          calls.push('clearLocalAppData');
          throw cleanupError;
        }),
        resetInMemoryStores,
      })
    ).rejects.toBeInstanceOf(AccountDeletionCleanupError);

    expect(calls).toEqual([
      'deleteBackendAccount',
      'cancelLocalReminders',
      'clearLocalAppData',
      'clearSession',
    ]);
    expect(resetInMemoryStores).not.toHaveBeenCalled();
  });
});
