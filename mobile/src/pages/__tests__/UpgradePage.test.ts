// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  revenueCatEnabled: true,
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  presentPremiumPaywall: vi.fn(),
  purchasePlan: vi.fn(),
  restorePurchases: vi.fn(),
  manageSubscription: vi.fn(),
  subscription: {
    availablePlans: [
      {
        id: 'premium_monthly' as const,
        name: 'Monthly',
        priceLabel: '$4.99',
        description: 'Monthly Premium',
        cadence: 'monthly' as const,
        planType: 'premium' as const,
        entitlementKey: 'premium' as const,
        productIds: { android: 'monthly' },
      },
      {
        id: 'premium_yearly' as const,
        name: 'Yearly',
        priceLabel: '$39.99',
        description: 'Yearly Premium',
        cadence: 'yearly' as const,
        planType: 'premium' as const,
        entitlementKey: 'premium' as const,
        productIds: { android: 'yearly' },
      },
    ],
    hasPremiumEntitlement: false,
    isPurchasing: false,
    isRestoring: false,
    isManaging: false,
    canManageSubscription: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    presentPremiumPaywall: state.presentPremiumPaywall,
    purchasePlan: state.purchasePlan,
    restorePurchases: state.restorePurchases,
    manageSubscription: state.manageSubscription,
  }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({ currentUserRole: state.role }),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    get isRevenueCatEnabled() {
      return state.revenueCatEnabled;
    },
  },
}));

import UpgradePage from '../UpgradePage.vue';

function mountUpgradePage() {
  return shallowMount(UpgradePage, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

beforeEach(() => {
  state.revenueCatEnabled = true;
  state.role = 'owner';
  state.presentPremiumPaywall.mockReset();
  state.purchasePlan.mockReset();
  state.restorePurchases.mockReset();
  state.manageSubscription.mockReset();
  Object.assign(state.subscription, {
    availablePlans: [
      {
        id: 'premium_monthly',
        name: 'Monthly',
        priceLabel: '$4.99',
        description: 'Monthly Premium',
        cadence: 'monthly',
        planType: 'premium',
        entitlementKey: 'premium',
        productIds: { android: 'monthly' },
      },
      {
        id: 'premium_yearly',
        name: 'Yearly',
        priceLabel: '$39.99',
        description: 'Yearly Premium',
        cadence: 'yearly',
        planType: 'premium',
        entitlementKey: 'premium',
        productIds: { android: 'yearly' },
      },
    ],
    hasPremiumEntitlement: false,
    isPurchasing: false,
    isRestoring: false,
    isManaging: false,
    canManageSubscription: false,
    statusMessage: '',
    errorMessage: '',
  });
});

describe('UpgradePage billing disclosure', () => {
  it('shows the live price, billing period, and renewal disclosure', () => {
    const wrapper = mountUpgradePage();

    expect(wrapper.text()).toContain('$4.99');
    expect(wrapper.text()).toContain('upgrade.plans.monthlyBillingPeriod');
    expect(wrapper.text()).toContain('upgrade.billingNote');
  });

  it('selects Yearly by default and lets the owner switch to Monthly', async () => {
    const wrapper = mountUpgradePage();

    expect(
      wrapper
        .get('[data-testid="plan-premium_yearly"]')
        .attributes('aria-pressed')
    ).toBe('true');

    await wrapper.get('[data-testid="plan-premium_monthly"]').trigger('click');

    expect(
      wrapper
        .get('[data-testid="plan-premium_monthly"]')
        .attributes('aria-pressed')
    ).toBe('true');
    expect(
      wrapper
        .get('[data-testid="plan-premium_yearly"]')
        .attributes('aria-pressed')
    ).toBe('false');
  });

  it('purchases the selected plan instead of opening the generic paywall', async () => {
    const wrapper = mountUpgradePage();

    await wrapper.get('[data-testid="plan-premium_monthly"]').trigger('click');
    await wrapper.get('[data-testid="start-premium"]').trigger('click');

    expect(state.purchasePlan).toHaveBeenCalledWith('premium_monthly');
    expect(state.presentPremiumPaywall).not.toHaveBeenCalled();
  });

  it('disables purchase when no live store plan is available', () => {
    state.subscription.availablePlans = [];

    const wrapper = mountUpgradePage();

    expect(wrapper.text()).toContain('upgrade.planUnavailable');
    expect(
      wrapper
        .get('button.upgrade-purchase-dock__primary')
        .attributes('disabled')
    ).toBeDefined();
  });

  it.each(['adult_member', 'viewer'] as const)(
    'hides all Upgrade billing actions from %s',
    (role) => {
      state.role = role;
      state.subscription.canManageSubscription = true;

      const wrapper = mountUpgradePage();

      expect(wrapper.find('[data-testid="start-premium"]').exists()).toBe(
        false
      );
      expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
        false
      );
      expect(wrapper.find('[data-testid="manage-subscription"]').exists()).toBe(
        false
      );
    }
  );

  it.each([
    ['a purchase is running', 'start-premium', { isPurchasing: true }],
    ['a restore is running', 'restore-purchases', { isRestoring: true }],
    [
      'management is running',
      'manage-subscription',
      { canManageSubscription: true, isManaging: true },
    ],
  ] as const)(
    'disables the Upgrade action while %s',
    (_, testId, subscription) => {
      Object.assign(state.subscription, subscription);

      expect(
        mountUpgradePage()
          .get(`[data-testid="${testId}"]`)
          .attributes('disabled')
      ).toBeDefined();
    }
  );

  it('disables purchase and Restore when native billing is unavailable', () => {
    state.revenueCatEnabled = false;

    const wrapper = mountUpgradePage();

    expect(
      wrapper.get('[data-testid="start-premium"]').attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="restore-purchases"]').attributes('disabled')
    ).toBeDefined();
  });

  it('renders safe status and error feedback in the Upgrade billing dock', () => {
    state.subscription.statusMessage = 'upgrade.premiumRestored';
    state.subscription.errorMessage = 'upgrade.restoreFailed';

    const wrapper = mountUpgradePage();

    expect(wrapper.get('[role="status"]').text()).toContain(
      'upgrade.premiumRestored'
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'upgrade.restoreFailed'
    );
  });
});
