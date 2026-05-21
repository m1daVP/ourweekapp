import { premiumFeatureKeys } from '@/features/access/featureAccess.config';
import { appConfig } from '@/shared/config/env';
import { premiumPlanOptions } from '../subscriptionPlans';
import type {
  SubscriptionActionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionSnapshot,
} from '../types';

const STORAGE_KEY = 'weekly-us:subscription:mock';
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
      label: 'Store billing is not connected in this build.',
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
  if (typeof window === 'undefined' || !canUseMockBilling()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return isStoredMockSubscriptionState(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeStoredMockState(state: StoredMockSubscriptionState) {
  if (typeof window === 'undefined' || !canUseMockBilling()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
          message: 'Mock purchases are disabled in production builds.',
        };
      }

      const plan = premiumPlanOptions.find((option) => option.id === planId);

      if (!plan) {
        throw new Error('This Premium plan is not available.');
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
        message: 'Mock Premium is enabled on this device.',
      };
    },
    async restorePurchases(): Promise<SubscriptionActionResult> {
      const snapshot = snapshotFromStoredState();

      return {
        status: snapshot.currentPlan === 'premium' ? 'completed' : 'cancelled',
        snapshot,
        message:
          snapshot.currentPlan === 'premium'
            ? 'Mock Premium was restored on this device.'
            : 'No mock Premium purchase was found on this device.',
      };
    },
    async manageSubscription() {
      return {
        supported: false,
        message:
          'Subscription management will open Google Play or App Store settings after real billing is configured.',
      };
    },
  };
}
