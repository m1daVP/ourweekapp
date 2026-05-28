import { premiumFeatureKeys } from '@/features/access/featureAccess.config';
import { translate } from '@/features/localization/i18n';
import { appConfig } from '@/shared/config/env';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import { premiumPlanOptions } from '../subscriptionPlans';
import type {
  SubscriptionActionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionSnapshot,
} from '../types';

const STORAGE_VERSION = 1;

interface StoredMockSubscriptionState {
  version: number;
  planId: SubscriptionPlanId;
  expiresAt: string;
  purchasedAt: string;
}

function createCheckedAt() {
  return new Date().toISOString();
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function canUseMockBilling() {
  return appConfig.appEnvironment !== 'production';
}

function createPremiumEntitlement(
  isActive: boolean,
  expiresAt?: string
): SubscriptionEntitlementStatus {
  return {
    key: 'premium',
    isActive,
    unlockedFeatures: isActive ? premiumFeatureKeys : [],
    verification: isActive ? 'mock' : 'none',
    expiresAt,
    checkedAt: createCheckedAt(),
  };
}

function createSnapshot(
  isPremium: boolean,
  expiresAt?: string
): SubscriptionSnapshot {
  const checkedAt = createCheckedAt();

  return {
    currentPlan: isPremium ? 'premium' : 'free',
    provider: 'mock',
    entitlements: {
      premium: createPremiumEntitlement(isPremium, expiresAt),
    },
    management: {
      supported: false,
      label: translate('upgrade.storeBillingNotConnected'),
    },
    checkedAt,
  };
}

function isStoredMockSubscriptionState(
  value: unknown
): value is StoredMockSubscriptionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredMockSubscriptionState>;

  return (
    candidate.version === STORAGE_VERSION &&
    (candidate.planId === 'premium_monthly' ||
      candidate.planId === 'premium_yearly') &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.purchasedAt === 'string'
  );
}

function readStoredMockState() {
  if (!canUseMockBilling()) {
    return null;
  }

  const storedState = readStorageSlice<unknown | null>(
    'subscriptionMockState',
    null
  );
  return isStoredMockSubscriptionState(storedState) ? storedState : null;
}

function writeStoredMockState(state: StoredMockSubscriptionState) {
  if (!canUseMockBilling()) {
    return;
  }

  writeStorageSlice('subscriptionMockState', state);
}

function snapshotFromStoredState() {
  const storedState = readStoredMockState();

  if (!storedState) {
    return createSnapshot(false);
  }

  const isActive = new Date(storedState.expiresAt).getTime() > Date.now();
  return createSnapshot(isActive, storedState.expiresAt);
}

export function createMockSubscriptionProvider(): SubscriptionProvider {
  return {
    kind: 'mock',
    async getCurrentPlan() {
      return snapshotFromStoredState();
    },
    async getAvailablePlans() {
      return premiumPlanOptions;
    },
    async purchasePlan(planId) {
      if (!canUseMockBilling()) {
        return {
          status: 'not_supported',
          snapshot: createSnapshot(false),
          message: translate('upgrade.mockPurchasesDisabled'),
        };
      }

      const plan = premiumPlanOptions.find((option) => option.id === planId);

      if (!plan) {
        throw new Error(translate('upgrade.planUnavailable'));
      }

      const purchasedAt = new Date();
      const expiresAt = addMonths(
        purchasedAt,
        plan.cadence === 'yearly' ? 12 : 1
      ).toISOString();

      writeStoredMockState({
        version: STORAGE_VERSION,
        planId,
        purchasedAt: purchasedAt.toISOString(),
        expiresAt,
      });

      return {
        status: 'completed',
        snapshot: createSnapshot(true, expiresAt),
        message: translate('upgrade.mockPremiumEnabled'),
      };
    },
    async restorePurchases(): Promise<SubscriptionActionResult> {
      const snapshot = snapshotFromStoredState();

      return {
        status: snapshot.currentPlan === 'premium' ? 'completed' : 'cancelled',
        snapshot,
        message:
          snapshot.currentPlan === 'premium'
            ? translate('upgrade.mockPremiumRestored')
            : translate('upgrade.noMockPremium'),
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
