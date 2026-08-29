// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  revenueCatEnabled: true,
  restorePurchases: vi.fn(),
  manageSubscription: vi.fn(),
  subscription: {
    hasPremiumEntitlement: false,
    canManageSubscription: false,
    isManaging: false,
    isRestoring: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('vue-i18n', () => ({
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
  reminderDayOptions: [],
  useRemindersStore: () => ({ settings: { enabled: false } }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    restorePurchases: state.restorePurchases,
    manageSubscription: state.manageSubscription,
  }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({ currentUserRole: state.role }),
}));

vi.mock('@/shared/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canUseFeature: () => false }),
}));

vi.mock('@/shared/composables/useNotifications', () => ({
  useNotifications: () => ({
    disableReminders: vi.fn(),
    enableReminders: vi.fn(),
    isAvailable: { value: false },
    lastError: { value: '' },
    lastReminderResult: { value: null },
    permissionStatus: { value: 'unknown' },
    syncPermissionStatus: vi.fn(),
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

vi.mock('@/shared/components/BaseBottomSheet.vue', () => ({
  default: { name: 'BaseBottomSheet' },
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
        BaseBottomSheet: true,
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

  it('renders the restore result inside the card for an owner', () => {
    state.subscription.statusMessage = 'upgrade.premiumRestored';
    state.subscription.errorMessage = 'upgrade.restoreFailed';

    const wrapper = mountSettingsPage();

    expect(wrapper.text()).toContain('upgrade.premiumRestored');
    expect(wrapper.text()).toContain('upgrade.restoreFailed');
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
