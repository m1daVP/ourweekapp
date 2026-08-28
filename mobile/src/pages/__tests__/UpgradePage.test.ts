// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  revenueCatEnabled: true,
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
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
    presentPremiumPaywall: vi.fn(),
    restorePurchases: vi.fn(),
    manageSubscription: vi.fn(),
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
});
