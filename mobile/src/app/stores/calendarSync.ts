import { defineStore } from 'pinia';
import { calendarService } from '@/features/calendar/services/calendarService';
import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';
import type {
  CalendarConnectionStatus,
  CalendarSyncSettings,
} from '@/features/calendar/types';

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
  const storedSettings =
    readSettingsStorage<Partial<CalendarSyncSettings> | null>(
      'calendarSync',
      null
    );

  if (!storedSettings) {
    return fallback;
  }

  return {
    addWeeklyMeetingReminder:
      storedSettings.addWeeklyMeetingReminder ??
      fallback.addWeeklyMeetingReminder,
    addTaskDueDates: storedSettings.addTaskDueDates ?? fallback.addTaskDueDates,
    addFollowUpDates:
      storedSettings.addFollowUpDates ?? fallback.addFollowUpDates,
    updatedAt: storedSettings.updatedAt ?? fallback.updatedAt,
  };
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
      writeSettingsStorage('calendarSync', this.settings);
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
