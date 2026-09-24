// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  revenueCatEnabled: true,
  restorePurchases: vi.fn(),
  manageSubscription: vi.fn(),
  enableReminders: vi.fn(),
  clearLastError: vi.fn(),
  clearSubscriptionError: vi.fn(),
  showToast: vi.fn(),
  showInAppNotification: vi.fn(),
  canUseReminders: false,
  notificationError: { value: '' as string | null },
  reminderSettings: {
    enabled: false,
    weeklyMeetingReminder: { day: 'sunday', time: '18:00' },
    unfinishedTaskReminder: { day: 'wednesday', time: '18:00' },
  },
  updateWeeklyMeetingReminder: vi.fn(),
  subscription: {
    hasPremiumEntitlement: false,
    canManageSubscription: false,
    isManaging: false,
    isRestoring: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}));

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock('@/app/stores/localization', () => ({
  useLocalizationStore: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/app/stores/reminders', () => ({
  reminderDayOptions: [
    { label: 'Sunday', value: 'sunday' },
    { label: 'Monday', value: 'monday' },
    { label: 'Wednesday', value: 'wednesday' },
  ],
  useRemindersStore: () => ({
    settings: state.reminderSettings,
    updateWeeklyMeetingReminder: state.updateWeeklyMeetingReminder,
  }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    restorePurchases: state.restorePurchases,
    manageSubscription: state.manageSubscription,
    clearStatusMessage: () => {
      state.subscription.statusMessage = '';
    },
    clearErrorMessage: state.clearSubscriptionError,
  }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({ currentUserRole: state.role }),
}));

vi.mock('@/shared/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canUseFeature: () => state.canUseReminders,
  }),
}));

vi.mock('@/shared/composables/useNotifications', () => ({
  useNotifications: () => ({
    clearLastError: state.clearLastError,
    disableReminders: vi.fn(),
    enableReminders: state.enableReminders,
    isAvailable: { value: false },
    lastError: state.notificationError,
    lastReminderResult: { value: null },
    permissionStatus: { value: 'unknown' },
    syncPermissionStatus: vi.fn(),
  }),
}));

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: state.showToast }),
}));

vi.mock('@/shared/composables/useInAppNotification', () => ({
  useInAppNotification: () => ({
    showInAppNotification: state.showInAppNotification,
  }),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    get isRevenueCatEnabled() {
      return state.revenueCatEnabled;
    },
    contactEmail: null,
  },
}));

vi.mock(
  '@/features/participants/components/HouseholdMembersSettings.vue',
  () => ({
    default: { name: 'HouseholdMembersSettings' },
  })
);

vi.mock('@/features/auth/components/AccountSettingsSection.vue', () => ({
  default: {
    name: 'AccountSettingsSection',
    template: '<section data-testid="account-settings-section" />',
  },
}));

vi.mock('@/shared/components/BaseBottomSheet.vue', () => ({
  default: { name: 'BaseBottomSheet' },
}));

vi.mock('@/shared/components/SelectPickerField.vue', () => ({
  default: { name: 'SelectPickerField' },
}));

vi.mock('@/shared/components/TimePickerField.vue', () => ({
  default: { name: 'TimePickerField' },
}));

vi.mock('@/shared/components/UpgradePrompt.vue', () => ({
  default: { name: 'UpgradePrompt' },
}));

import SettingsPage from '../SettingsPage.vue';

function mountSettingsPage() {
  return shallowMount(SettingsPage, {
    global: {
      stubs: {
        HouseholdMembersSettings: true,
        BaseBottomSheet: {
          props: ['open'],
          template: '<div><slot /></div>',
        },
        SelectPickerField: true,
        TimePickerField: true,
        UpgradePrompt: true,
        RouterLink: true,
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.revenueCatEnabled = true;
  state.restorePurchases.mockReset();
  state.manageSubscription.mockReset();
  state.enableReminders.mockReset();
  state.clearLastError.mockReset();
  state.clearSubscriptionError.mockReset();
  state.showToast.mockReset();
  state.showInAppNotification.mockReset();
  state.updateWeeklyMeetingReminder.mockReset();
  state.canUseReminders = false;
  state.notificationError.value = '';
  state.reminderSettings.enabled = false;
  Object.assign(state.subscription, {
    hasPremiumEntitlement: false,
    canManageSubscription: false,
    isManaging: false,
    isRestoring: false,
    statusMessage: '',
    errorMessage: '',
  });
});

describe('SettingsPage restore purchases', () => {
  it('embeds account controls without an account-route link', () => {
    const wrapper = mountSettingsPage();

    expect(wrapper.find('account-settings-section-stub').exists()).toBe(true);
    expect(wrapper.find('.settings-account-summary').exists()).toBe(true);
  });

  it('shows locked Premium benefits for a Free household', () => {
    const icons = mountSettingsPage().findAll(
      '[data-testid="subscription-benefit-icon"]'
    );

    expect(icons).toHaveLength(3);
    expect(icons.every((icon) => icon.text() === 'lock')).toBe(true);
    expect(
      icons.every((icon) =>
        icon.classes('settings-subscription-benefit__icon--locked')
      )
    ).toBe(true);
  });

  it('shows enabled Premium benefits for an active Premium household', () => {
    state.subscription.hasPremiumEntitlement = true;

    const icons = mountSettingsPage().findAll(
      '[data-testid="subscription-benefit-icon"]'
    );

    expect(icons).toHaveLength(3);
    expect(icons.every((icon) => icon.text() === 'check')).toBe(true);
    expect(
      icons.some((icon) =>
        icon.classes('settings-subscription-benefit__icon--locked')
      )
    ).toBe(false);
  });

  it('shows Restore purchases to an owner and invokes the store action', async () => {
    const wrapper = mountSettingsPage();

    await wrapper.get('[data-testid="restore-purchases"]').trigger('click');

    expect(state.restorePurchases).toHaveBeenCalledOnce();
  });

  it.each(['adult_member', 'viewer'] as const)(
    'does not show Restore purchases to %s',
    (role) => {
      state.role = role;

      expect(
        mountSettingsPage().find('[data-testid="restore-purchases"]').exists()
      ).toBe(false);
    }
  );

  it.each([
    ['a restore is already running', { isRestoring: true }, true],
    ['RevenueCat is not configured', {}, false],
  ] as const)(
    'disables Restore purchases when %s',
    (_, subscription, configured) => {
      Object.assign(state.subscription, subscription);
      state.revenueCatEnabled = configured;

      expect(
        mountSettingsPage()
          .get('[data-testid="restore-purchases"]')
          .attributes('disabled')
      ).toBeDefined();
    }
  );

  it('forwards subscription feedback to the top notification', () => {
    state.subscription.statusMessage = 'upgrade.premiumRestored';
    state.subscription.errorMessage = 'upgrade.restoreFailed';

    const wrapper = mountSettingsPage();

    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'upgrade.premiumRestored'
    );
    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'upgrade.restoreFailed',
      { tone: 'error' }
    );
    expect(state.clearSubscriptionError).toHaveBeenCalledOnce();
    expect(wrapper.text()).not.toContain('upgrade.premiumRestored');
    expect(wrapper.text()).not.toContain('upgrade.restoreFailed');
  });

  it('shows Manage subscription only to an owner when management is supported', async () => {
    state.subscription.hasPremiumEntitlement = true;
    state.subscription.canManageSubscription = true;

    const wrapper = mountSettingsPage();

    await wrapper.get('[data-testid="manage-subscription"]').trigger('click');

    expect(state.manageSubscription).toHaveBeenCalledOnce();
  });

  it('hides every Settings billing action from a non-owner', () => {
    state.role = 'adult_member';
    state.subscription.hasPremiumEntitlement = true;
    state.subscription.canManageSubscription = true;

    const wrapper = mountSettingsPage();

    expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="manage-subscription"]').exists()).toBe(
      false
    );
  });

  it('disables Manage subscription while management is in progress', () => {
    state.subscription.hasPremiumEntitlement = true;
    state.subscription.canManageSubscription = true;
    state.subscription.isManaging = true;

    expect(
      mountSettingsPage()
        .get('[data-testid="manage-subscription"]')
        .attributes('disabled')
    ).toBeDefined();
  });
});

describe('SettingsPage notification permissions', () => {
  it('forwards reminder failures to the top notification', () => {
    state.notificationError.value = 'notifications.updateFailed';

    const wrapper = mountSettingsPage();

    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'notifications.updateFailed',
      { tone: 'error' }
    );
    expect(state.clearLastError).toHaveBeenCalledOnce();
    expect(wrapper.text()).not.toContain('notifications.updateFailed');
  });

  it('shows a toast and keeps reminders off when notification access is declined', async () => {
    state.canUseReminders = true;
    state.enableReminders.mockResolvedValue('permission-denied');
    const wrapper = mountSettingsPage();

    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.vm.$forceUpdate();

    expect(state.enableReminders).toHaveBeenCalledOnce();
    expect(state.showToast).toHaveBeenCalledWith(
      'notifications.permissionDeclined'
    );
    expect(
      (wrapper.get('input[type="checkbox"]').element as HTMLInputElement)
        .checked
    ).toBe(false);
  });

  it('does not show a declined-access toast after permission is granted', async () => {
    state.canUseReminders = true;
    state.enableReminders.mockResolvedValue('enabled');
    const wrapper = mountSettingsPage();

    await wrapper.get('input[type="checkbox"]').setValue(true);

    expect(state.showToast).not.toHaveBeenCalled();
  });
});

describe('SettingsPage weekly reminder pickers', () => {
  it('persists picker values through the existing reminder store action', async () => {
    const wrapper = mountSettingsPage();

    await wrapper
      .getComponent({ name: 'SelectPickerField' })
      .vm.$emit('update:modelValue', 'monday');
    await wrapper
      .getComponent({ name: 'TimePickerField' })
      .vm.$emit('update:modelValue', '07:05');

    expect(state.updateWeeklyMeetingReminder).toHaveBeenNthCalledWith(1, {
      day: 'monday',
    });
    expect(state.updateWeeklyMeetingReminder).toHaveBeenNthCalledWith(2, {
      time: '07:05',
    });
  });
});
