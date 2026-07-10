import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const reminderServiceMocks = vi.hoisted(() => ({
  cancelReminderNotifications: vi.fn(),
  checkNotificationPermission: vi.fn(),
  localNotificationsAvailable: vi.fn(),
  requestNotificationPermission: vi.fn(),
  scheduleReminderNotifications: vi.fn(),
}));

vi.mock('@/features/reminders/reminderService', () => ({
  cancelReminderNotifications: reminderServiceMocks.cancelReminderNotifications,
  checkNotificationPermission: reminderServiceMocks.checkNotificationPermission,
  localNotificationsAvailable: reminderServiceMocks.localNotificationsAvailable,
  requestNotificationPermission:
    reminderServiceMocks.requestNotificationPermission,
  scheduleReminderNotifications:
    reminderServiceMocks.scheduleReminderNotifications,
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readSettingsStorage: (_key: string, fallback: unknown) => fallback,
  writeSettingsStorage: vi.fn(),
  readStorageSlice: (_key: string, fallback: unknown) => fallback,
  writeStorageSlice: vi.fn(),
}));

describe('useNotifications free-plan reminder scheduling', () => {
  beforeEach(() => {
    vi.resetModules();
    setActivePinia(createPinia());

    reminderServiceMocks.cancelReminderNotifications.mockReset();
    reminderServiceMocks.checkNotificationPermission.mockReset();
    reminderServiceMocks.localNotificationsAvailable.mockReset();
    reminderServiceMocks.requestNotificationPermission.mockReset();
    reminderServiceMocks.scheduleReminderNotifications.mockReset();

    reminderServiceMocks.localNotificationsAvailable.mockReturnValue(true);
    reminderServiceMocks.checkNotificationPermission.mockResolvedValue({
      display: 'granted',
    });
    reminderServiceMocks.requestNotificationPermission.mockResolvedValue({
      display: 'granted',
    });
    reminderServiceMocks.scheduleReminderNotifications.mockResolvedValue({
      scheduled: true,
    });
    reminderServiceMocks.cancelReminderNotifications.mockResolvedValue(
      undefined
    );
  });

  it('lets a free-plan user enable reminders (regression for H2)', async () => {
    const { useNotifications } = await import(
      '@/shared/composables/useNotifications'
    );
    const { useRemindersStore } = await import('@/app/stores/reminders');

    const remindersStore = useRemindersStore();
    const { enableReminders, lastError } = useNotifications();

    const result = await enableReminders();

    expect(result).toBe(true);
    expect(
      reminderServiceMocks.scheduleReminderNotifications
    ).toHaveBeenCalled();
    expect(remindersStore.settings.enabled).toBe(true);
    expect(lastError.value).toBeNull();
  });

  it('reschedules reminders for a free-plan user when already enabled', async () => {
    const { useNotifications } = await import(
      '@/shared/composables/useNotifications'
    );
    const { useRemindersStore } = await import('@/app/stores/reminders');

    const remindersStore = useRemindersStore();
    remindersStore.setEnabled(true);

    const { rescheduleReminders } = useNotifications();
    const result = await rescheduleReminders();

    expect(
      reminderServiceMocks.scheduleReminderNotifications
    ).toHaveBeenCalled();
    expect(result).toMatchObject({ scheduled: true });
    expect(
      reminderServiceMocks.cancelReminderNotifications
    ).not.toHaveBeenCalled();
  });

  it('cancels reminders when disabled', async () => {
    const { useNotifications } = await import(
      '@/shared/composables/useNotifications'
    );
    const { useRemindersStore } = await import('@/app/stores/reminders');

    const remindersStore = useRemindersStore();
    remindersStore.setEnabled(false);

    const { rescheduleReminders } = useNotifications();
    const result = await rescheduleReminders();

    expect(
      reminderServiceMocks.cancelReminderNotifications
    ).toHaveBeenCalled();
    expect(result).toEqual({ scheduled: false, reason: 'disabled' });
  });

  it('keeps reminders disabled when notification permission is denied', async () => {
    reminderServiceMocks.requestNotificationPermission.mockResolvedValue({
      display: 'denied',
    });

    const { useNotifications } = await import(
      '@/shared/composables/useNotifications'
    );
    const { useRemindersStore } = await import('@/app/stores/reminders');

    const remindersStore = useRemindersStore();
    const { enableReminders } = useNotifications();

    const result = await enableReminders();

    expect(result).toBe(false);
    expect(remindersStore.settings.enabled).toBe(false);
    expect(
      reminderServiceMocks.cancelReminderNotifications
    ).toHaveBeenCalled();
  });
});
