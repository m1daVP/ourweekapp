import { premiumFeatureKeys } from '@/features/access/featureAccess.config';
import { translate } from '@/features/localization/i18n';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  restoreSubscription,
  validateSubscription,
  type SubscriptionStatusDto,
} from '@/shared/api/subscriptionsApi';
import { premiumPlanOptions } from '../subscriptionPlans';
import { nativeBillingService } from './nativeBillingService';
import type {
  SubscriptionActionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionProviderKind,
  SubscriptionSnapshot,
} from '../types';

function mapProviderKind(
  provider: SubscriptionStatusDto['provider']
): SubscriptionProviderKind {
  return provider === 'revenuecat' ? 'revenuecat' : 'direct_store';
}

function createPremiumEntitlement(
  status: SubscriptionStatusDto
): SubscriptionEntitlementStatus {
  const unlockedFeatures =
    status.planType === 'premium'
      ? status.enabledFeatures.filter((featureKey) =>
          premiumFeatureKeys.includes(featureKey)
        )
      : [];

  return {
    key: 'premium',
    isActive: status.planType === 'premium',
    unlockedFeatures,
    verification: status.planType === 'premium' ? 'backend' : 'none',
    expiresAt: status.expiresAt ?? undefined,
    checkedAt: status.checkedAt,
  };
}

export function createSubscriptionSnapshotFromStatus(
  status: SubscriptionStatusDto
): SubscriptionSnapshot {
  return {
    currentPlan: status.planType,
    provider: mapProviderKind(status.provider),
    entitlements: {
      premium: createPremiumEntitlement(status),
    },
    management: {
      supported: status.provider !== null,
      label: status.provider
        ? translate('upgrade.manageAvailable')
        : translate('upgrade.manageUnavailable'),
    },
    checkedAt: status.checkedAt,
  };
}

export function createBackendSubscriptionProvider(): SubscriptionProvider {
  return {
    kind: 'direct_store',
    async getCurrentPlan() {
      return createSubscriptionSnapshotFromStatus(
        await getSubscriptionStatus()
      );
    },
    async getAvailablePlans() {
      return premiumPlanOptions;
    },
    async purchasePlan(planId: SubscriptionPlanId) {
      const purchase = await nativeBillingService.purchasePlan(planId);
      const snapshot = createSubscriptionSnapshotFromStatus(
        await validateSubscription(purchase)
      );

      return {
        status: snapshot.currentPlan === 'premium' ? 'completed' : 'cancelled',
        snapshot,
        message:
          snapshot.currentPlan === 'premium'
            ? translate('upgrade.premiumEnabled')
            : translate('upgrade.noPremiumFound'),
      };
    },
    async restorePurchases(): Promise<SubscriptionActionResult> {
      const provider = nativeBillingService.getRestoreProvider();

      if (!provider) {
        return {
          status: 'not_supported',
          snapshot: createSubscriptionSnapshotFromStatus(
            await getSubscriptionStatus()
          ),
          message: translate('upgrade.billingUnavailable'),
        };
      }

      const snapshot = createSubscriptionSnapshotFromStatus(
        await restoreSubscription({ provider })
      );

      return {
        status: snapshot.currentPlan === 'premium' ? 'completed' : 'cancelled',
        snapshot,
        message:
          snapshot.currentPlan === 'premium'
            ? translate('upgrade.premiumRestored')
            : translate('upgrade.noPremiumFound'),
      };
    },
    async manageSubscription() {
      const { url } = await getSubscriptionManagementUrl();

      return {
        supported: Boolean(url),
        message: url
          ? translate('upgrade.managementOpened')
          : translate('upgrade.manageUnavailable'),
        url,
      };
    },
  };
}
