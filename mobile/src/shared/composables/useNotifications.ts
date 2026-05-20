import { computed, ref, watch } from 'vue'
import type { PermissionState } from '@capacitor/core'
import { useRemindersStore } from '@/app/stores/reminders'
import { useTasksStore } from '@/app/stores/tasks'
import { useUserAccessStore } from '@/app/stores/userAccess'
import {
  cancelReminderNotifications,
  checkNotificationPermission,
  localNotificationsAvailable,
  requestNotificationPermission,
  scheduleReminderNotifications,
  type ReminderScheduleResult,
} from '@/features/reminders/reminderService'

type NotificationStatus = PermissionState | 'unknown' | 'unavailable'

const permissionStatus = ref<NotificationStatus>('unknown')
const lastReminderResult = ref<ReminderScheduleResult | null>(null)
const lastError = ref<string | null>(null)
let initialized = false

export function useNotifications() {
  const remindersStore = useRemindersStore()
  const tasksStore = useTasksStore()
  const accessStore = useUserAccessStore()

  const isAvailable = computed(() => localNotificationsAvailable())
  const canScheduleReminders = computed(
    () => accessStore.isPremium && remindersStore.settings.enabled,
  )

  async function syncPermissionStatus() {
    lastError.value = null

    try {
      const permission = await checkNotificationPermission()
      permissionStatus.value = permission?.display ?? 'unavailable'
    } catch {
      permissionStatus.value = 'unavailable'
      lastError.value = 'Notifications are not available in this environment.'
    }
  }

  async function enableReminders() {
    lastError.value = null

    if (!accessStore.isPremium) {
      lastError.value = 'Reminder scheduling is a premium feature.'
      remindersStore.setEnabled(false)
      await cancelReminderNotifications()
      return false
    }

    if (!localNotificationsAvailable()) {
      permissionStatus.value = 'unavailable'
      remindersStore.setEnabled(true)
      lastReminderResult.value = { scheduled: false, reason: 'unavailable' }
      return true
    }

    const permission = await requestNotificationPermission()
    permissionStatus.value = permission?.display ?? 'unavailable'

    if (permission?.display !== 'granted') {
      remindersStore.setEnabled(false)
      await cancelReminderNotifications()
      return false
    }

    remindersStore.setEnabled(true)
    await rescheduleReminders()
    return true
  }

  async function disableReminders() {
    lastError.value = null
    remindersStore.setEnabled(false)
    await cancelReminderNotifications()
    lastReminderResult.value = { scheduled: false, reason: 'disabled' }
  }

  async function rescheduleReminders() {
    lastError.value = null

    try {
      if (!accessStore.isPremium || !remindersStore.settings.enabled) {
        await cancelReminderNotifications()
        lastReminderResult.value = { scheduled: false, reason: 'disabled' }
        return lastReminderResult.value
      }

      lastReminderResult.value = await scheduleReminderNotifications(
        remindersStore.settings,
        {
          agreements: tasksStore.agreements.length,
          tasks: tasksStore.openTasks.length,
        },
      )

      await syncPermissionStatus()
      return lastReminderResult.value
    } catch {
      lastError.value = 'Reminder scheduling could not be updated.'
      lastReminderResult.value = { scheduled: false, reason: 'unavailable' }
      return lastReminderResult.value
    }
  }

  function initializeReminderSync() {
    if (initialized) {
      return
    }

    initialized = true

    watch(
      () => [
        accessStore.planType,
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
        void rescheduleReminders()
      },
      { immediate: true },
    )
  }

  return {
    canScheduleReminders,
    disableReminders,
    enableReminders,
    initializeReminderSync,
    isAvailable,
    lastError,
    lastReminderResult,
    permissionStatus,
    rescheduleReminders,
    syncPermissionStatus,
  }
}
