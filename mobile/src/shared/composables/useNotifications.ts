import { computed, ref, watch } from 'vue';
import type { PermissionState } from '@capacitor/core';
import { useRemindersStore } from '@/app/stores/reminders';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useTasksStore } from '@/app/stores/tasks';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { canUseFeatureAccess } from '@/features/access/featureAccessPolicy';
import { translate } from '@/features/localization/i18n';
import {
  cancelReminderNotifications,
  checkNotificationPermission,
  localNotificationsAvailable,
  requestNotificationPermission,
  scheduleReminderNotifications,
  type ReminderScheduleResult,
} from '@/features/reminders/reminderService';

type NotificationStatus = PermissionState | 'unknown' | 'unavailable';

export type EnableRemindersResult =
  'enabled' | 'permission-denied' | 'unavailable' | 'error' | 'premium-only';

const permissionStatus = ref<NotificationStatus>('unknown');
const lastReminderResult = ref<ReminderScheduleResult | null>(null);
const lastError = ref<string | null>(null);
let initialized = false;

export function useNotifications() {
  const remindersStore = useRemindersStore();
  const subscriptionStore = useSubscriptionStore();
  const tasksStore = useTasksStore();
  const workspaceStore = useWorkspaceStore();

  function canUseReminderFeature() {
    return canUseFeatureAccess(
      subscriptionStore.getFeatureAccess('agreementReminders')
    );
  }

  const isAvailable = computed(() => localNotificationsAvailable());
  const canScheduleReminders = computed(
    () => canUseReminderFeature() && remindersStore.settings.enabled
  );

  function clearLastError() {
    lastError.value = null;
  }

  async function disableAfterUnsuccessfulEnable() {
    remindersStore.setEnabled(false);

    try {
      await cancelReminderNotifications();
    } catch {
      // The setting must stay off even if native cleanup is unavailable.
    }
  }

  async function syncPermissionStatus() {
    lastError.value = null;

    try {
      const permission = await checkNotificationPermission();
      permissionStatus.value = permission?.display ?? 'unavailable';
    } catch {
      permissionStatus.value = 'unavailable';
      lastError.value = translate('notifications.unavailable');
    }
  }

  async function enableReminders(): Promise<EnableRemindersResult> {
    lastError.value = null;

    if (!canUseReminderFeature()) {
      lastError.value = translate('notifications.premiumOnly');
      await disableAfterUnsuccessfulEnable();
      return 'premium-only';
    }

    if (!localNotificationsAvailable()) {
      permissionStatus.value = 'unavailable';
      remindersStore.setEnabled(true);
      lastReminderResult.value = { scheduled: false, reason: 'unavailable' };
      return 'unavailable';
    }

    try {
      const currentPermission = await checkNotificationPermission();
      permissionStatus.value = currentPermission?.display ?? 'unavailable';

      if (currentPermission?.display === 'denied') {
        lastReminderResult.value = {
          scheduled: false,
          reason: 'permission-denied',
        };
        await disableAfterUnsuccessfulEnable();
        return 'permission-denied';
      }

      const permission = await requestNotificationPermission();
      permissionStatus.value = permission?.display ?? 'unavailable';

      if (permission?.display !== 'granted') {
        lastReminderResult.value = {
          scheduled: false,
          reason: 'permission-denied',
        };
        await disableAfterUnsuccessfulEnable();
        return 'permission-denied';
      }

      remindersStore.setEnabled(true);
      await rescheduleReminders();
      return 'enabled';
    } catch {
      await disableAfterUnsuccessfulEnable();
      lastError.value = translate('notifications.updateFailed');
      lastReminderResult.value = { scheduled: false, reason: 'unavailable' };
      return 'error';
    }
  }

  async function disableReminders() {
    lastError.value = null;
    remindersStore.setEnabled(false);
    await cancelReminderNotifications();
    lastReminderResult.value = { scheduled: false, reason: 'disabled' };
  }

  async function rescheduleReminders() {
    lastError.value = null;

    try {
      if (!canUseReminderFeature() || !remindersStore.settings.enabled) {
        await cancelReminderNotifications();
        lastReminderResult.value = { scheduled: false, reason: 'disabled' };
        return lastReminderResult.value;
      }

      lastReminderResult.value = await scheduleReminderNotifications(
        remindersStore.settings,
        {
          agreements: tasksStore.agreements.length,
          tasks: tasksStore.openTasks.length,
        }
      );

      await syncPermissionStatus();
      return lastReminderResult.value;
    } catch {
      lastError.value = translate('notifications.updateFailed');
      lastReminderResult.value = { scheduled: false, reason: 'unavailable' };
      return lastReminderResult.value;
    }
  }

  function initializeReminderSync() {
    if (initialized) {
      return;
    }

    initialized = true;

    watch(
      () => [
        subscriptionStore.currentPlan,
        subscriptionStore.hasPremiumEntitlement,
        workspaceStore.currentUserRole,
        remindersStore.settings.enabled,
        remindersStore.settings.weeklyMeetingReminder.day,
        remindersStore.settings.weeklyMeetingReminder.time,
        remindersStore.settings.unfinishedTaskReminder.day,
        remindersStore.settings.unfinishedTaskReminder.time,
        tasksStore.openTasks
          .map((task) => `${task.id}:${task.updatedAt}`)
          .join('|'),
        tasksStore.agreements
          .map((agreement) => `${agreement.id}:${agreement.updatedAt}`)
          .join('|'),
      ],
      () => {
        void rescheduleReminders();
      },
      { immediate: true }
    );
  }

  return {
    canScheduleReminders,
    clearLastError,
    disableReminders,
    enableReminders,
    initializeReminderSync,
    isAvailable,
    lastError,
    lastReminderResult,
    permissionStatus,
    rescheduleReminders,
    syncPermissionStatus,
  };
}
