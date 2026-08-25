import { Capacitor } from '@capacitor/core';
import { translate } from '@/features/localization/i18n';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  restoreSubscriptionStatus,
} from '@/shared/api/subscriptionsApi';
import { warnSafely } from '@/shared/services/safeLogService';
import { premiumPlanOptions } from '../subscriptionPlans';
import { createSubscriptionSnapshotFromStatus } from './backendSubscriptionProvider';
import {
  findPackageByProductId,
  getCurrentOffering,
  getRevenueCatCustomerInfo,
  hasOurWeekPremium,
  isRevenueCatAvailable,
  presentPremiumPaywall,
  presentRevenueCatCustomerCenter,
  purchasePackage,
  restoreRevenueCatPurchases,
} from './revenueCatService';
import type {
  SubscriptionActionResult,
  SubscriptionPlanOption,
  SubscriptionProvider,
  SubscriptionSnapshot,
} from '../types';

function getCurrentPlatformKey(): 'android' | 'ios' | null {
  const platform = Capacitor.getPlatform();

  if (platform === 'android' || platform === 'ios') {
    return platform;
  }

  return null;
}

function getPlanProductId(plan: SubscriptionPlanOption) {
  const platform = getCurrentPlatformKey();

  return platform ? plan.productIds[platform] : undefined;
}

function isPurchaseCancelled(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    userCancelled?: unknown;
  };

  return (
    candidate.userCancelled === true ||
    candidate.code === 'PURCHASE_CANCELLED' ||
    candidate.code === 'PurchaseCancelledError'
  );
}

async function getBackendSnapshot() {
  return createSubscriptionSnapshotFromStatus(await getSubscriptionStatus());
}

async function syncSubscriptionWithBackend() {
  const platform = getCurrentPlatformKey();

  if (!platform) {
    throw new Error(translate('upgrade.billingUnavailable'));
  }

  return createSubscriptionSnapshotFromStatus(
    await restoreSubscriptionStatus({
      provider: platform === 'android' ? 'google_play' : 'app_store',
    })
  );
}

async function syncPurchasedSubscriptionWithBackend() {
  const snapshot = await syncSubscriptionWithBackend();

  if (snapshot.currentPlan !== 'premium') {
    throw new Error('Premium activation is not available yet.');
  }

  return snapshot;
}

function createPendingActivationSnapshot() {
  const checkedAt = new Date().toISOString();

  return createSubscriptionSnapshotFromStatus({
    planType: 'free',
    provider: null,
    enabledFeatures: [
      'basicMeetings',
      'defaultTemplate',
      'tasksAndAgreements',
      'manualResponsibility',
      'meetingHistory',
      'limitedHistory',
      'unlimitedHistory',
    ],
    expiresAt: null,
    checkedAt,
  });
}

function createActionResult(
  snapshot: SubscriptionSnapshot,
  activeMessage: string
): SubscriptionActionResult {
  const hasPremium = snapshot.currentPlan === 'premium';

  return {
    status: hasPremium ? 'completed' : 'cancelled',
    snapshot,
    message: hasPremium ? activeMessage : translate('upgrade.noPremiumFound'),
  };
}

async function getRevenueCatPlans() {
  if (!isRevenueCatAvailable()) {
    return premiumPlanOptions;
  }

  try {
    const offering = await getCurrentOffering();

    if (!offering) {
      return premiumPlanOptions;
    }

    return premiumPlanOptions.map((plan) => {
      const productId = getPlanProductId(plan);
      const matchingPackage = offering.availablePackages.find(
        (candidate) => candidate.product.identifier === productId
      );

      return {
        ...plan,
        priceLabel: matchingPackage?.product.priceString ?? plan.priceLabel,
      };
    });
  } catch (error) {
    warnSafely('Unable to load RevenueCat offerings.', error);
    return premiumPlanOptions;
  }
}

async function handlePaywallOrCustomerInfoResult(activeMessage: string) {
  const customerInfoResult = await getRevenueCatCustomerInfo().catch(
    (error: unknown) => {
      warnSafely('Unable to refresh RevenueCat customer info.', error);
      return null;
    }
  );

  if (
    customerInfoResult &&
    hasOurWeekPremium(customerInfoResult.customerInfo)
  ) {
    return createActionResult(
      await syncSubscriptionWithBackend(),
      activeMessage
    );
  }

  return createActionResult(await getBackendSnapshot(), activeMessage);
}

export function createRevenueCatSubscriptionProvider(): SubscriptionProvider {
  return {
    kind: 'revenuecat',
    async getCurrentPlan() {
      return getBackendSnapshot();
    },
    async getAvailablePlans() {
      return getRevenueCatPlans();
    },
    async purchasePlan(planId) {
      if (!isRevenueCatAvailable()) {
        return {
          status: 'not_supported',
          snapshot: await getBackendSnapshot(),
          message: translate('upgrade.billingUnavailable'),
        };
      }

      const plan = premiumPlanOptions.find((option) => option.id === planId);
      const productId = plan ? getPlanProductId(plan) : undefined;

      if (!plan || !productId) {
        throw new Error(translate('upgrade.billingUnavailable'));
      }

      const packageToPurchase = await findPackageByProductId(productId);

      if (!packageToPurchase) {
        throw new Error(translate('upgrade.billingUnavailable'));
      }

      try {
        await purchasePackage(packageToPurchase);
      } catch (error) {
        if (isPurchaseCancelled(error)) {
          return {
            status: 'cancelled',
            snapshot: await getBackendSnapshot(),
          };
        }

        throw error;
      }

      try {
        return createActionResult(
          await syncPurchasedSubscriptionWithBackend(),
          translate('upgrade.premiumEnabled')
        );
      } catch (firstError) {
        warnSafely(
          'Unable to activate RevenueCat purchase on the first attempt.',
          firstError
        );

        try {
          return createActionResult(
            await syncPurchasedSubscriptionWithBackend(),
            translate('upgrade.premiumEnabled')
          );
        } catch (retryError) {
          warnSafely(
            'RevenueCat purchase activation is pending backend sync.',
            retryError
          );

          return {
            status: 'completed',
            snapshot: createPendingActivationSnapshot(),
            message: translate('upgrade.activationPending'),
          };
        }
      }
    },
    async restorePurchases() {
      if (!isRevenueCatAvailable()) {
        return {
          status: 'not_supported',
          snapshot: await getBackendSnapshot(),
          message: translate('upgrade.billingUnavailable'),
        };
      }

      await restoreRevenueCatPurchases();

      return createActionResult(
        await syncSubscriptionWithBackend(),
        translate('upgrade.premiumRestored')
      );
    },
    async manageSubscription() {
      if (isRevenueCatAvailable()) {
        try {
          await presentRevenueCatCustomerCenter();

          return {
            supported: true,
            message: translate('upgrade.managementOpened'),
          };
        } catch (error) {
          warnSafely('Unable to open RevenueCat Customer Center.', error);
        }
      }

      const { url } = await getSubscriptionManagementUrl();

      return {
        supported: Boolean(url),
        message: url
          ? translate('upgrade.managementOpened')
          : translate('upgrade.manageUnavailable'),
        url,
      };
    },
    async presentPremiumPaywall() {
      if (!isRevenueCatAvailable()) {
        return {
          status: 'not_supported',
          snapshot: await getBackendSnapshot(),
          message: translate('upgrade.billingUnavailable'),
        };
      }

      const didPurchaseOrRestore = await presentPremiumPaywall();

      if (didPurchaseOrRestore) {
        return createActionResult(
          await syncSubscriptionWithBackend(),
          translate('upgrade.premiumEnabled')
        );
      }

      return handlePaywallOrCustomerInfoResult(
        translate('upgrade.premiumEnabled')
      );
    },
    async refreshCustomerInfo() {
      if (!isRevenueCatAvailable()) {
        return {
          status: 'not_supported',
          snapshot: await getBackendSnapshot(),
          message: translate('upgrade.billingUnavailable'),
        };
      }

      return handlePaywallOrCustomerInfoResult(
        translate('upgrade.premiumEnabled')
      );
    },
  };
}
