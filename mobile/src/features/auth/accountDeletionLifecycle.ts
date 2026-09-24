export interface AccountDeletionLifecycleDependencies {
  deleteBackendAccount: () => Promise<void>;
  clearSession: () => Promise<void>;
  clearLocalAppData: () => Promise<void>;
  resetInMemoryStores: () => void;
  cancelLocalReminders?: () => Promise<void>;
  onReminderCancelError?: (error: unknown) => void;
}

export class AccountDeletionCleanupError extends Error {
  cause?: unknown;

  constructor(cause?: unknown) {
    super('Account deleted, but local device cleanup did not finish.');
    this.name = 'AccountDeletionCleanupError';
    this.cause = cause;
  }
}

export async function deleteAccountAndClearLocalData({
  deleteBackendAccount,
  clearSession,
  cancelLocalReminders,
  clearLocalAppData,
  resetInMemoryStores,
  onReminderCancelError,
}: AccountDeletionLifecycleDependencies): Promise<void> {
  await deleteBackendAccount();

  let cleanupError: unknown;

  try {
    if (cancelLocalReminders) {
      try {
        await cancelLocalReminders();
      } catch (error) {
        onReminderCancelError?.(error);
      }
    }

    await clearLocalAppData();
    resetInMemoryStores();
  } catch (error) {
    cleanupError = error;
  }

  try {
    await clearSession();
  } catch (error) {
    throw new AccountDeletionCleanupError(error);
  }

  if (cleanupError) {
    throw new AccountDeletionCleanupError(cleanupError);
  }
}
