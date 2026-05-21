import { defineStore } from 'pinia';
import type {
  ReminderDay,
  ReminderSettings,
  ReminderTimeSlot,
} from '@/features/reminders/types';

const STORAGE_KEY = 'weekly-us:reminder-settings';

export const reminderDayOptions: Array<{ label: string; value: ReminderDay }> =
  [
    { label: 'Sunday', value: 'sunday' },
    { label: 'Monday', value: 'monday' },
    { label: 'Tuesday', value: 'tuesday' },
    { label: 'Wednesday', value: 'wednesday' },
    { label: 'Thursday', value: 'thursday' },
    { label: 'Friday', value: 'friday' },
    { label: 'Saturday', value: 'saturday' },
  ];

const reminderDays = new Set(reminderDayOptions.map((option) => option.value));

function nowIso() {
  return new Date().toISOString();
}

function defaultSettings(): ReminderSettings {
  return {
    enabled: false,
    weeklyMeetingReminder: {
      day: 'sunday',
      time: '18:00',
    },
    unfinishedTaskReminder: {
      day: 'wednesday',
      time: '18:00',
    },
    updatedAt: nowIso(),
  };
}

function normalizeTimeSlot(
  value: Partial<ReminderTimeSlot> | undefined,
  fallback: ReminderTimeSlot
): ReminderTimeSlot {
  const day =
    value?.day && reminderDays.has(value.day) ? value.day : fallback.day;
  const time =
    value?.time && /^\d{2}:\d{2}$/.test(value.time)
      ? value.time
      : fallback.time;

  return { day, time };
}

function getStoredSettings(): ReminderSettings {
  const fallback = defaultSettings();

  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<ReminderSettings>;

    return {
      enabled: Boolean(parsedValue.enabled),
      weeklyMeetingReminder: normalizeTimeSlot(
        parsedValue.weeklyMeetingReminder,
        fallback.weeklyMeetingReminder
      ),
      unfinishedTaskReminder: normalizeTimeSlot(
        parsedValue.unfinishedTaskReminder,
        fallback.unfinishedTaskReminder
      ),
      updatedAt: parsedValue.updatedAt ?? fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

export const useRemindersStore = defineStore('reminders', {
  state: () => ({
    settings: getStoredSettings(),
  }),
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    },
    setEnabled(enabled: boolean) {
      this.settings.enabled = enabled;
      this.settings.updatedAt = nowIso();
      this.persist();
    },
    updateWeeklyMeetingReminder(payload: Partial<ReminderTimeSlot>) {
      this.settings.weeklyMeetingReminder = normalizeTimeSlot(payload, {
        ...this.settings.weeklyMeetingReminder,
      });
      this.settings.updatedAt = nowIso();
      this.persist();
    },
    updateUnfinishedTaskReminder(payload: Partial<ReminderTimeSlot>) {
      this.settings.unfinishedTaskReminder = normalizeTimeSlot(payload, {
        ...this.settings.unfinishedTaskReminder,
      });
      this.settings.updatedAt = nowIso();
      this.persist();
    },
  },
});
