import { appConfig } from '@/shared/config/env';
import { createBackendSubscriptionProvider } from './backendSubscriptionProvider';
import { createMockSubscriptionProvider } from './mockSubscriptionProvider';
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
    if (!appConfig.isBackendApiEnabled) {
      activeProvider = createMockSubscriptionProvider();
    } else if (isRevenueCatAvailable()) {
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

/*
Production billing TODOs:
- Prefer RevenueCat for the MVP because @revenuecat/purchases-capacitor
  supports Android and iOS through one Capacitor SDK, includes store receipt
  handling, and maps products to entitlements.
- Configure a single RevenueCat entitlement named "OurWeek Premium" and attach
  the "monthly" and "yearly" store products from subscriptionPlans.ts.
- Validate real premium access through the backend after RevenueCat purchase or
  restore. Do not persist permanent Premium access from this frontend store in
  production.
- If OurWeek later chooses direct store billing instead, keep it behind this
  same SubscriptionProvider contract and send Google Play purchase tokens or
  Apple signed transactions to the backend before unlocking Premium.
*/
