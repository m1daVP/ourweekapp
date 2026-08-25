import { beforeEach, describe, expect, it, vi } from 'vitest';
import { premiumPlanOptions } from '@/features/subscription/subscriptionPlans';
import { createRevenueCatSubscriptionProvider } from '@/features/subscription/services/revenueCatSubscriptionProvider';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  restoreSubscriptionStatus,
  type SubscriptionStatusDto,
} from '@/shared/api/subscriptionsApi';
import {
  findPackageByProductId,
  getCurrentOffering,
  getRevenueCatCustomerInfo,
  hasOurWeekPremium,
  isRevenueCatAvailable,
  presentPremiumPaywall,
  purchasePackage,
  restoreRevenueCatPurchases,
} from '@/features/subscription/services/revenueCatService';

const mockAppConfig = vi.hoisted(() => ({
  revenueCatEntitlementId: 'OurWeek Premium',
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: mockAppConfig,
}));

vi.mock('@/shared/api/subscriptionsApi', async () => {
  const actual = await vi.importActual<
    typeof import('@/shared/api/subscriptionsApi')
  >('@/shared/api/subscriptionsApi');

  return {
    ...actual,
    getSubscriptionStatus: vi.fn(),
    restoreSubscriptionStatus: vi.fn(),
    getSubscriptionManagementUrl: vi.fn(),
  };
});

vi.mock('@/features/subscription/services/revenueCatService', () => ({
  isRevenueCatAvailable: vi.fn(),
  getCurrentOffering: vi.fn(),
  findPackageByProductId: vi.fn(),
  purchasePackage: vi.fn(),
  restoreRevenueCatPurchases: vi.fn(),
  getRevenueCatCustomerInfo: vi.fn(),
  hasOurWeekPremium: vi.fn(),
  presentPremiumPaywall: vi.fn(),
  presentRevenueCatCustomerCenter: vi.fn(),
}));

const freeStatus: SubscriptionStatusDto = {
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
  checkedAt: '2026-06-16T00:00:00.000Z',
};

const premiumStatus: SubscriptionStatusDto = {
  planType: 'premium',
  provider: 'revenuecat',
  enabledFeatures: [
    'basicMeetings',
    'defaultTemplate',
    'tasksAndAgreements',
    'manualResponsibility',
    'meetingHistory',
    'limitedHistory',
    'unlimitedHistory',
  ],
  expiresAt: '2026-07-16T00:00:00.000Z',
  checkedAt: '2026-06-16T00:00:00.000Z',
};

const premiumStatusWithAccessMap: SubscriptionStatusDto = {
  ...premiumStatus,
  features: {
    ...Object.fromEntries(premiumStatus.enabledFeatures.map((key) => [key, {
      key,
      tier: 'free',
      lifecycle: 'available',
      state: 'available',
      roleEligible: true,
      upgradeEligible: false,
    }])),
    advancedStatistics: {
      key: 'advancedStatistics',
      tier: 'premium',
      lifecycle: 'planned',
      state: 'notYetAvailable',
      roleEligible: true,
      upgradeEligible: false,
    },
  } as SubscriptionStatusDto['features'],
};

const mockedGetSubscriptionStatus = vi.mocked(getSubscriptionStatus);
const mockedRestoreSubscriptionStatus = vi.mocked(restoreSubscriptionStatus);
const mockedGetSubscriptionManagementUrl = vi.mocked(
  getSubscriptionManagementUrl
);
const mockedIsRevenueCatAvailable = vi.mocked(isRevenueCatAvailable);
const mockedGetCurrentOffering = vi.mocked(getCurrentOffering);
const mockedFindPackageByProductId = vi.mocked(findPackageByProductId);
const mockedPurchasePackage = vi.mocked(purchasePackage);
const mockedRestoreRevenueCatPurchases = vi.mocked(restoreRevenueCatPurchases);
const mockedGetRevenueCatCustomerInfo = vi.mocked(getRevenueCatCustomerInfo);
const mockedHasOurWeekPremium = vi.mocked(hasOurWeekPremium);
const mockedPresentPremiumPaywall = vi.mocked(presentPremiumPaywall);

describe('RevenueCat subscription configuration', () => {
  it('maps Premium plans to the configured store product identifiers', () => {
    expect(
      premiumPlanOptions.map((plan) => ({
        id: plan.id,
        android: plan.productIds.android,
        ios: plan.productIds.ios,
      }))
    ).toEqual([
      {
        id: 'premium_monthly',
        android: 'monthly',
        ios: 'monthly',
      },
      {
        id: 'premium_yearly',
        android: 'yearly',
        ios: 'yearly',
      },
    ]);
  });
});

describe('createRevenueCatSubscriptionProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIsRevenueCatAvailable.mockReturnValue(true);
    mockedGetSubscriptionStatus.mockResolvedValue(freeStatus);
    mockedRestoreSubscriptionStatus.mockResolvedValue(premiumStatus);
    mockedGetSubscriptionManagementUrl.mockResolvedValue({ url: '' });
    mockedGetRevenueCatCustomerInfo.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            'OurWeek Premium': {},
          },
        },
      },
    } as Awaited<ReturnType<typeof getRevenueCatCustomerInfo>>);
    mockedHasOurWeekPremium.mockReturnValue(true);
    mockedPresentPremiumPaywall.mockResolvedValue(true);
  });

  it('fills plan prices from RevenueCat offerings without changing product ids', async () => {
    mockedGetCurrentOffering.mockResolvedValue({
      availablePackages: [
        {
          product: {
            identifier: 'monthly',
            priceString: '$4.99',
          },
        },
        {
          product: {
            identifier: 'yearly',
            priceString: '$39.99',
          },
        },
      ],
    } as Awaited<ReturnType<typeof getCurrentOffering>>);

    const provider = createRevenueCatSubscriptionProvider();
    const plans = await provider.getAvailablePlans();

    expect(plans).toMatchObject([
      { id: 'premium_monthly', priceLabel: '$4.99' },
      { id: 'premium_yearly', priceLabel: '$39.99' },
    ]);
  });

  it('keeps live provider prices available for plan card rendering', async () => {
    mockedGetCurrentOffering.mockResolvedValue({
      availablePackages: [
        {
          product: {
            identifier: 'monthly',
            priceString: '$4.99',
          },
        },
      ],
    } as Awaited<ReturnType<typeof getCurrentOffering>>);

    const provider = createRevenueCatSubscriptionProvider();
    const plans = await provider.getAvailablePlans();

    expect(plans[0]?.priceLabel).toBe('$4.99');
    expect(plans[1]?.priceLabel).toBe('Price pending');
  });

  it('keeps a completed purchase pending after repeated free backend snapshots', async () => {
    mockedFindPackageByProductId.mockResolvedValue({
      product: { identifier: 'monthly' },
    } as Awaited<ReturnType<typeof findPackageByProductId>>);
    mockedRestoreSubscriptionStatus.mockResolvedValue(freeStatus);

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.purchasePlan('premium_monthly');

    expect(mockedPurchasePackage).toHaveBeenCalled();
    expect(mockedRestoreSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.message).toBe(
      'Purchase received — Premium will activate shortly'
    );
    expect(result.snapshot.currentPlan).toBe('free');
    expect(result.snapshot.entitlements.premium.isActive).toBe(false);
  });

  it('retries a free backend snapshot and activates Premium on the second sync', async () => {
    mockedFindPackageByProductId.mockResolvedValue({
      product: { identifier: 'monthly' },
    } as Awaited<ReturnType<typeof findPackageByProductId>>);
    mockedRestoreSubscriptionStatus
      .mockResolvedValueOnce(freeStatus)
      .mockResolvedValueOnce(premiumStatus);

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.purchasePlan('premium_monthly');

    expect(mockedPurchasePackage).toHaveBeenCalled();
    expect(mockedRestoreSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.message).toBe('Premium is active for this account.');
    expect(result.snapshot.currentPlan).toBe('premium');
    expect(result.snapshot.entitlements.premium.isActive).toBe(true);
  });

  it('preserves planned access-map entries without treating them as unlocked', async () => {
    mockedGetSubscriptionStatus.mockResolvedValue(premiumStatusWithAccessMap);

    const provider = createRevenueCatSubscriptionProvider();
    const snapshot = await provider.getCurrentPlan();

    expect(snapshot.featureAccess.advancedStatistics).toMatchObject({
      state: 'notYetAvailable',
      upgradeEligible: false,
    });
    expect(snapshot.entitlements.premium.unlockedFeatures).not.toContain(
      'advancedStatistics'
    );
  });

  it('keeps meeting history available when mapping a legacy Free status response', async () => {
    const provider = createRevenueCatSubscriptionProvider();

    const snapshot = await provider.getCurrentPlan();

    expect(snapshot.featureAccess.meetingHistory).toMatchObject({
      tier: 'free',
      state: 'available',
      upgradeEligible: false,
    });
    expect(snapshot.featureAccess.unlimitedHistory.state).toBe('available');
  });

  it('keeps the backend snapshot when the user cancels purchase', async () => {
    mockedFindPackageByProductId.mockResolvedValue({
      product: { identifier: 'monthly' },
    } as Awaited<ReturnType<typeof findPackageByProductId>>);
    mockedPurchasePackage.mockRejectedValue({ userCancelled: true });

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.purchasePlan('premium_monthly');

    expect(result.status).toBe('cancelled');
    expect(result.snapshot.currentPlan).toBe('free');
    expect(mockedRestoreSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('syncs restored purchases through the backend', async () => {
    mockedRestoreSubscriptionStatus.mockResolvedValue(freeStatus);

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.restorePurchases();

    expect(mockedRestoreRevenueCatPurchases).toHaveBeenCalled();
    expect(mockedRestoreSubscriptionStatus).toHaveBeenCalledWith({
      provider: 'google_play',
    });
    expect(result.status).toBe('cancelled');
    expect(result.snapshot.currentPlan).toBe('free');
  });

  it('fails safely when the configured RevenueCat package is missing', async () => {
    mockedFindPackageByProductId.mockResolvedValue(null);

    const provider = createRevenueCatSubscriptionProvider();

    await expect(provider.purchasePlan('premium_monthly')).rejects.toThrow();
    expect(mockedPurchasePackage).not.toHaveBeenCalled();
  });

  it('syncs after a paywall purchase result before unlocking Premium', async () => {
    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.presentPremiumPaywall?.();

    expect(mockedPresentPremiumPaywall).toHaveBeenCalled();
    expect(mockedRestoreSubscriptionStatus).toHaveBeenCalledWith({
      provider: 'google_play',
    });
    expect(result?.status).toBe('completed');
    expect(result?.snapshot.entitlements.premium.isActive).toBe(true);
  });

  it('keeps a completed purchase pending after two backend sync failures', async () => {
    mockedFindPackageByProductId.mockResolvedValue({
      product: { identifier: 'monthly' },
    } as Awaited<ReturnType<typeof findPackageByProductId>>);
    mockedRestoreSubscriptionStatus.mockRejectedValue(
      new Error('provider unavailable')
    );

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.purchasePlan('premium_monthly');

    expect(mockedPurchasePackage).toHaveBeenCalled();
    expect(mockedRestoreSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      status: 'completed',
      message: 'Purchase received — Premium will activate shortly',
      snapshot: { currentPlan: 'free' },
    });
  });
});
