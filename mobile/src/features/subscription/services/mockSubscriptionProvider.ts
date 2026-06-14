import { translate } from '@/features/localization/i18n';
import { nowIso } from '@/shared/utils/dates';
import { premiumPlanOptions } from '../subscriptionPlans';
import type {
  SubscriptionActionResult,
  SubscriptionEntitlementStatus,
  SubscriptionProvider,
  SubscriptionSnapshot,
} from '../types';

function createCheckedAt() {
  return nowIso();
}

function createFreeEntitlement(): SubscriptionEntitlementStatus {
  return {
    key: 'premium',
    isActive: false,
    unlockedFeatures: [],
    verification: 'none',
    checkedAt: createCheckedAt(),
  };
}

function createSnapshot(): SubscriptionSnapshot {
  const checkedAt = createCheckedAt();

  return {
    currentPlan: 'free',
    provider: 'mock',
    entitlements: {
      premium: createFreeEntitlement(),
    },
    management: {
      supported: false,
      label: translate('upgrade.storeBillingNotConnected'),
    },
    checkedAt,
  };
}

export function createMockSubscriptionProvider(): SubscriptionProvider {
  return {
    kind: 'mock',
    async getCurrentPlan() {
      return createSnapshot();
    },
    async getAvailablePlans() {
      return premiumPlanOptions;
    },
    async purchasePlan(planId) {
      const plan = premiumPlanOptions.find((option) => option.id === planId);

      if (!plan) {
        throw new Error(translate('upgrade.planUnavailable'));
      }

      return {
        status: 'not_supported',
        snapshot: createSnapshot(),
        message: translate('upgrade.billingUnavailable'),
      };
    },
    async restorePurchases(): Promise<SubscriptionActionResult> {
      return {
        status: 'not_supported',
        snapshot: createSnapshot(),
        message: translate('upgrade.billingUnavailable'),
      };
    },
    async manageSubscription() {
      return {
        supported: false,
        message: translate('upgrade.managementLater'),
      };
    },
  };
}
