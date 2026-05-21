import { defineStore } from 'pinia';
import { calendarService } from '@/features/calendar/services/calendarService';
import type {
  CalendarConnectionStatus,
  CalendarSyncSettings,
} from '@/features/calendar/types';

const STORAGE_KEY = 'weekly-us:calendar-sync-settings';

type CalendarSyncSettingKey =
  | 'addWeeklyMeetingReminder'
  | 'addTaskDueDates'
  | 'addFollowUpDates';

interface CalendarSyncState {
  settings: CalendarSyncSettings;
  connectionStatus: CalendarConnectionStatus | null;
  isCheckingConnection: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  statusMessage: string;
  errorMessage: string;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultSettings(): CalendarSyncSettings {
  return {
    addWeeklyMeetingReminder: true,
    addTaskDueDates: true,
    addFollowUpDates: true,
    updatedAt: nowIso(),
  };
}

function getStoredSettings(): CalendarSyncSettings {
  const fallback = defaultSettings();

  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<CalendarSyncSettings>;

    return {
      addWeeklyMeetingReminder:
        parsedValue.addWeeklyMeetingReminder ??
        fallback.addWeeklyMeetingReminder,
      addTaskDueDates: parsedValue.addTaskDueDates ?? fallback.addTaskDueDates,
      addFollowUpDates:
        parsedValue.addFollowUpDates ?? fallback.addFollowUpDates,
      updatedAt: parsedValue.updatedAt ?? fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

export const useCalendarSyncStore = defineStore('calendarSync', {
  state: (): CalendarSyncState => ({
    settings: getStoredSettings(),
    connectionStatus: null,
    isCheckingConnection: false,
    isConnecting: false,
    isDisconnecting: false,
    statusMessage: '',
    errorMessage: '',
  }),
  getters: {
    isConnected: (state) => Boolean(state.connectionStatus?.connected),
  },
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    },
    updateSetting(key: CalendarSyncSettingKey, enabled: boolean) {
      this.settings[key] = enabled;
      this.settings.updatedAt = nowIso();
      this.persist();
    },
    async initializeCalendarConnection() {
      this.isCheckingConnection = true;
      this.errorMessage = '';

      try {
        this.connectionStatus =
          await calendarService.getCalendarConnectionStatus();
        this.statusMessage = this.connectionStatus.message;
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : 'Something went wrong while checking Calendar sync.';
      } finally {
        this.isCheckingConnection = false;
      }
    },
    async connectCalendar() {
      this.isConnecting = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        this.connectionStatus = await calendarService.connectCalendar();
        this.statusMessage = this.connectionStatus.message;
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : 'Something went wrong while starting Calendar sync.';
      } finally {
        this.isConnecting = false;
      }
    },
    async disconnectCalendar() {
      this.isDisconnecting = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        this.connectionStatus = await calendarService.disconnectCalendar();
        this.statusMessage = this.connectionStatus.message;
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : 'Something went wrong while disconnecting Calendar sync.';
      } finally {
        this.isDisconnecting = false;
      }
    },
  },
});
