import { createMockSubscriptionProvider } from './mockSubscriptionProvider';
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
    activeProvider = createMockSubscriptionProvider();
  }

  return activeProvider;
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
};

/*
Production billing TODOs:
- Prefer RevenueCat for the MVP because @revenuecat/purchases-capacitor
  supports Android and iOS through one Capacitor SDK, includes store receipt
  handling, and maps products to entitlements.
- Configure a single RevenueCat entitlement named "premium" and attach the
  Google Play and App Store subscription products from subscriptionPlans.ts.
- Validate real premium access through RevenueCat trusted entitlements and/or a
  backend subscription status endpoint. Do not persist permanent Premium access
  from this frontend store in production.
- If Weekly Us later chooses direct store billing instead, keep it behind this
  same SubscriptionProvider contract and send Google Play purchase tokens or
  Apple signed transactions to the backend before unlocking Premium.
*/
