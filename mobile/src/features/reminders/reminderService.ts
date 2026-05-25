import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  Weekday,
  type LocalNotificationSchema,
  type PermissionStatus,
} from '@capacitor/local-notifications';
import { translate } from '@/features/localization/i18n';
import type { ReminderDay, ReminderSettings } from './types';

export interface UnfinishedReminderCounts {
  agreements: number;
  tasks: number;
}

export interface ReminderScheduleResult {
  scheduled: boolean;
  reason?: 'disabled' | 'unavailable' | 'permission-denied';
}

const ANDROID_CHANNEL_ID = 'weekly-us-reminders';
const WEEKLY_MEETING_NOTIFICATION_ID = 840_100;
const UNFINISHED_TASKS_NOTIFICATION_ID = 840_101;
const REMINDER_NOTIFICATION_IDS = [
  WEEKLY_MEETING_NOTIFICATION_ID,
  UNFINISHED_TASKS_NOTIFICATION_ID,
];

const weekdayByDay: Record<ReminderDay, Weekday> = {
  sunday: Weekday.Sunday,
  monday: Weekday.Monday,
  tuesday: Weekday.Tuesday,
  wednesday: Weekday.Wednesday,
  thursday: Weekday.Thursday,
  friday: Weekday.Friday,
  saturday: Weekday.Saturday,
};

export function localNotificationsAvailable() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable('LocalNotifications')
  );
}

export async function checkNotificationPermission(): Promise<PermissionStatus | null> {
  if (!localNotificationsAvailable()) {
    return null;
  }

  return LocalNotifications.checkPermissions();
}

export async function requestNotificationPermission(): Promise<PermissionStatus | null> {
  if (!localNotificationsAvailable()) {
    return null;
  }

  return LocalNotifications.requestPermissions();
}

export async function cancelReminderNotifications() {
  if (!localNotificationsAvailable()) {
    return;
  }

  await LocalNotifications.cancel({
    notifications: REMINDER_NOTIFICATION_IDS.map((id) => ({ id })),
  });
}

export async function scheduleReminderNotifications(
  settings: ReminderSettings,
  counts: UnfinishedReminderCounts
): Promise<ReminderScheduleResult> {
  await cancelReminderNotifications();

  if (!settings.enabled) {
    return { scheduled: false, reason: 'disabled' };
  }

  if (!localNotificationsAvailable()) {
    return { scheduled: false, reason: 'unavailable' };
  }

  const permission = await LocalNotifications.checkPermissions();

  if (permission.display !== 'granted') {
    return { scheduled: false, reason: 'permission-denied' };
  }

  await ensureAndroidChannel();

  const notifications: LocalNotificationSchema[] = [
    {
      id: WEEKLY_MEETING_NOTIFICATION_ID,
      title: translate('reminders.title'),
      body: translate('reminders.weeklyMeetingBody'),
      channelId: ANDROID_CHANNEL_ID,
      autoCancel: true,
      schedule: createWeeklySchedule(settings.weeklyMeetingReminder),
    },
  ];

  if (counts.tasks > 0 || counts.agreements > 0) {
    notifications.push({
      id: UNFINISHED_TASKS_NOTIFICATION_ID,
      title: translate('reminders.title'),
      body: createUnfinishedReminderBody(counts),
      channelId: ANDROID_CHANNEL_ID,
      autoCancel: true,
      schedule: createWeeklySchedule(settings.unfinishedTaskReminder),
    });
  }

  await LocalNotifications.schedule({ notifications });

  return { scheduled: true };
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  await LocalNotifications.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: translate('reminders.channelName'),
    description: translate('reminders.channelDescription'),
    importance: 3,
    visibility: 1,
    lights: false,
    vibration: false,
  });
}

function createWeeklySchedule(slot: ReminderSettings['weeklyMeetingReminder']) {
  const [hour = 18, minute = 0] = slot.time
    .split(':')
    .map((value) => Number.parseInt(value, 10));

  return {
    on: {
      weekday: weekdayByDay[slot.day],
      hour,
      minute,
      second: 0,
    },
    repeats: true,
  };
}

function createUnfinishedReminderBody(counts: UnfinishedReminderCounts) {
  if (counts.tasks > 0 && counts.agreements > 0) {
    return translate('reminders.unfinishedBoth');
  }

  if (counts.tasks > 0) {
    return translate('reminders.unfinishedTasks');
  }

  return translate('reminders.unfinishedAgreements');
}
