import { Capacitor } from '@capacitor/core';
import { translate } from '@/features/localization/i18n';
import { createBackendSubscriptionProvider } from './backendSubscriptionProvider';
import { createRevenueCatSubscriptionProvider } from './revenueCatSubscriptionProvider';
import { isRevenueCatAvailable } from './revenueCatService';
import type {
  ManageSubscriptionResult,
  SubscriptionActionResult,
  SubscriptionPlanId,
  SubscriptionPlanOption,
  SubscriptionProvider,
  SubscriptionSnapshot,
} from '../types';

let activeProvider: SubscriptionProvider | null = null;

function getActiveProvider() {
  if (!activeProvider) {
    if (Capacitor.isNativePlatform()) {
      if (!isRevenueCatAvailable()) {
        throw new Error(translate('upgrade.billingUnavailable'));
      }

      activeProvider = createRevenueCatSubscriptionProvider();
    } else {
      activeProvider = createBackendSubscriptionProvider();
    }
  }

  return activeProvider;
}

async function getUnsupportedActionResult(): Promise<SubscriptionActionResult> {
  return {
    status: 'not_supported',
    snapshot: await getActiveProvider().getCurrentPlan(),
  };
}

export const subscriptionsService = {
  getCurrentPlan(): Promise<SubscriptionSnapshot> {
    return getActiveProvider().getCurrentPlan();
  },
  getAvailablePlans(): Promise<SubscriptionPlanOption[]> {
    return getActiveProvider().getAvailablePlans();
  },
  purchasePlan(planId: SubscriptionPlanId): Promise<SubscriptionActionResult> {
    return getActiveProvider().purchasePlan(planId);
  },
  restorePurchases(): Promise<SubscriptionActionResult> {
    return getActiveProvider().restorePurchases();
  },
  manageSubscription(): Promise<ManageSubscriptionResult> {
    return getActiveProvider().manageSubscription();
  },
  presentPremiumPaywall(): Promise<SubscriptionActionResult> {
    return (
      getActiveProvider().presentPremiumPaywall?.() ??
      getUnsupportedActionResult()
    );
  },
  refreshCustomerInfo(): Promise<SubscriptionActionResult> {
    return (
      getActiveProvider().refreshCustomerInfo?.() ??
      getUnsupportedActionResult()
    );
  },
};
