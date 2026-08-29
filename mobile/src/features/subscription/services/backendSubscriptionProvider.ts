import { createLegacyFeatureAccessMap } from '@/features/access/legacyFeatureAccess';
import { translate } from '@/features/localization/i18n';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  type SubscriptionStatusDto,
} from '@/shared/api/subscriptionsApi';
import { premiumPlanOptions } from '../subscriptionPlans';
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
  return provider === 'revenuecat' ? 'revenuecat' : 'backend';
}

function createPremiumEntitlement(
  status: SubscriptionStatusDto,
  featureAccess: ReturnType<typeof createLegacyFeatureAccessMap>
): SubscriptionEntitlementStatus {
  const unlockedFeatures = Object.values(featureAccess)
    .filter(
      (feature) => feature.tier === 'premium' && feature.state === 'available'
    )
    .map((feature) => feature.key);

  return {
    key: 'premium',
    isActive: status.planType === 'premium',
    unlockedFeatures,
    verification: status.planType === 'premium' ? 'backend' : 'none',
    expiresAt: status.expiresAt ?? undefined,
    checkedAt: status.checkedAt,
    assistantRecap: status.assistantRecap ?? null,
  };
}

export function createSubscriptionSnapshotFromStatus(
  status: SubscriptionStatusDto
): SubscriptionSnapshot {
  const featureAccess = status.features ?? createLegacyFeatureAccessMap(status);

  return {
    currentPlan: status.planType,
    featureAccess,
    provider: mapProviderKind(status.provider),
    entitlements: {
      premium: createPremiumEntitlement(status, featureAccess),
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
    kind: 'backend',
    async getCurrentPlan() {
      return createSubscriptionSnapshotFromStatus(
        await getSubscriptionStatus()
      );
    },
    async getAvailablePlans() {
      return premiumPlanOptions;
    },
    async purchasePlan(planId: SubscriptionPlanId) {
      void planId;
      const snapshot = createSubscriptionSnapshotFromStatus(
        await getSubscriptionStatus()
      );

      return {
        status: 'not_supported',
        snapshot,
        message: translate('upgrade.billingUnavailable'),
      };
    },
    async restorePurchases(): Promise<SubscriptionActionResult> {
      const snapshot = createSubscriptionSnapshotFromStatus(
        await getSubscriptionStatus()
      );

      return {
        status: 'not_supported',
        snapshot,
        message: translate('upgrade.billingUnavailable'),
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
