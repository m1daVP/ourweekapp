// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  isConnected: true,
  initializeCalendarConnection: vi.fn(),
  connectCalendar: vi.fn(),
  disconnectCalendar: vi.fn(),
  retrySync: vi.fn(),
  updateSettings: vi.fn(),
  clearErrorMessage: vi.fn(),
  clearStatusMessage: vi.fn(),
  showInAppNotification: vi.fn(),
  statusMessage: '',
  errorMessage: '',
  connectionStatus: {
    provider: 'google' as const,
    state: 'connected' as const,
    connected: true,
    lastCheckedAt: '2026-08-30T10:00:00.000Z',
    message: 'Google Calendar is connected.',
    preferences: {
      weeklyMeetingSyncEnabled: true,
      assignedTaskSyncEnabled: false,
      weeklyMeetingDay: 'sunday' as const,
      weeklyMeetingTime: '18:00',
      timeZone: 'UTC',
    },
  },
}));

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/app/stores/calendarSync', () => ({
  useCalendarSyncStore: () => ({
    get isConnected() {
      return state.isConnected;
    },
    connectionStatus: state.connectionStatus,
    isCheckingConnection: false,
    isConnecting: false,
    isDisconnecting: false,
    statusMessage: state.statusMessage,
    errorMessage: state.errorMessage,
    clearErrorMessage: state.clearErrorMessage,
    clearStatusMessage: state.clearStatusMessage,
    initializeCalendarConnection: state.initializeCalendarConnection,
    connectCalendar: state.connectCalendar,
    disconnectCalendar: state.disconnectCalendar,
    retrySync: state.retrySync,
    updateSettings: state.updateSettings,
  }),
}));

vi.mock('@/features/calendar/services/calendarCallback', () => ({
  parseCalendarCallbackQuery: () => null,
}));

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/shared/composables/useInAppNotification', () => ({
  useInAppNotification: () => ({
    showInAppNotification: state.showInAppNotification,
  }),
}));

vi.mock('@/shared/components/PremiumLock.vue', () => ({
  default: { template: '<div><slot /></div>' },
}));

vi.mock('@/shared/components/ConfirmationDialog.vue', () => ({
  default: { template: '<div />' },
}));

vi.mock('@/shared/components/SelectPickerField.vue', () => ({
  default: {
    name: 'SelectPickerField',
    template: '<button v-bind="$attrs" type="button" />',
  },
}));

vi.mock('@/shared/components/TimePickerField.vue', () => ({
  default: {
    name: 'TimePickerField',
    template: '<button v-bind="$attrs" type="button" />',
  },
}));

import CalendarSyncPage from '../CalendarSyncPage.vue';

function mountCalendarSyncPage() {
  return mount(CalendarSyncPage);
}

const originalDateTimeFormat = Intl.DateTimeFormat;

beforeEach(() => {
  state.isConnected = true;
  state.connectionStatus.connected = true;
  state.updateSettings.mockReset();
  state.initializeCalendarConnection.mockReset();
  state.clearErrorMessage.mockReset();
  state.clearStatusMessage.mockReset();
  state.showInAppNotification.mockReset();
  state.statusMessage = '';
  state.errorMessage = '';
  vi.stubGlobal('Intl', {
    ...Intl,
    DateTimeFormat: () =>
      ({
        resolvedOptions: () => ({ timeZone: 'Europe/Warsaw' }),
      }) as Intl.DateTimeFormat,
  });
});

afterEach(() => {
  vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: originalDateTimeFormat });
});

describe('CalendarSyncPage weekly meeting schedule', () => {
  it('forwards calendar failures to the top notification', () => {
    state.errorMessage = 'calendar.checkFailed';

    const wrapper = mountCalendarSyncPage();

    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'calendar.checkFailed',
      { tone: 'error' }
    );
    expect(state.clearErrorMessage).toHaveBeenCalledOnce();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('disables weekday and time controls before Google Calendar is connected', () => {
    state.isConnected = false;
    state.connectionStatus.connected = false;

    const wrapper = mountCalendarSyncPage();

    expect(
      wrapper.get('[data-testid="calendar-weekday"]').attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="calendar-time"]').attributes('disabled')
    ).toBeDefined();
  });

  it('saves a weekday change with the stored time and device time zone', async () => {
    const wrapper = mountCalendarSyncPage();

    await wrapper
      .getComponent({ name: 'SelectPickerField' })
      .vm.$emit('update:modelValue', 'wednesday');

    expect(state.updateSettings).toHaveBeenCalledWith({
      weeklyMeetingDay: 'wednesday',
      weeklyMeetingTime: '18:00',
      timeZone: 'Europe/Warsaw',
    });
  });

  it('saves a time change with the stored weekday and device time zone', async () => {
    const wrapper = mountCalendarSyncPage();

    await wrapper
      .getComponent({ name: 'TimePickerField' })
      .vm.$emit('update:modelValue', '19:30');

    expect(state.updateSettings).toHaveBeenCalledWith({
      weeklyMeetingDay: 'sunday',
      weeklyMeetingTime: '19:30',
      timeZone: 'Europe/Warsaw',
    });
  });
});
