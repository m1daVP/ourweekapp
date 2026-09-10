import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import { calendarService } from '@/features/calendar/services/calendarService';
import type {
  CalendarConnectionStatus,
  UpdateCalendarPreferences,
} from '@/features/calendar/types';

interface CalendarSyncState {
  connectionStatus: CalendarConnectionStatus | null;
  isCheckingConnection: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  statusMessage: string;
  errorMessage: string;
}

export const useCalendarSyncStore = defineStore('calendarSync', {
  state: (): CalendarSyncState => ({
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
    clearStatusMessage() {
      this.statusMessage = '';
    },
    async initializeCalendarConnection() {
      this.isCheckingConnection = true;
      this.errorMessage = '';

      try {
        this.connectionStatus =
          await calendarService.getCalendarConnectionStatus();
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('calendar.checkFailed');
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
            : translate('calendar.startFailed');
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
            : translate('calendar.disconnectFailed');
      } finally {
        this.isDisconnecting = false;
      }
    },
    async updateSettings(payload: UpdateCalendarPreferences) {
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        this.connectionStatus =
          await calendarService.updateCalendarSettings(payload);
        this.statusMessage = this.connectionStatus.message;
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('calendar.checkFailed');
      }
    },
    async retrySync() {
      this.errorMessage = '';

      try {
        const result = await calendarService.retryCalendarSync();
        this.statusMessage = result.message;
        await this.initializeCalendarConnection();
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('calendar.checkFailed');
      }
    },
  },
});
