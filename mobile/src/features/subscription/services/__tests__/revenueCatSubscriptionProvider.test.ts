import { beforeEach, describe, expect, it, vi } from 'vitest';
import { premiumPlanOptions } from '@/features/subscription/subscriptionPlans';
import { createRevenueCatSubscriptionProvider } from '@/features/subscription/services/revenueCatSubscriptionProvider';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  validateRevenueCatSubscription,
  type SubscriptionStatusDto,
} from '@/shared/api/subscriptionsApi';
import {
  findPackageByProductId,
  getCurrentOffering,
  getRevenueCatAppUserID,
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
    validateRevenueCatSubscription: vi.fn(),
    getSubscriptionManagementUrl: vi.fn(),
  };
});

vi.mock('@/features/subscription/services/revenueCatService', () => ({
  isRevenueCatAvailable: vi.fn(),
  getCurrentOffering: vi.fn(),
  findPackageByProductId: vi.fn(),
  purchasePackage: vi.fn(),
  restoreRevenueCatPurchases: vi.fn(),
  getRevenueCatAppUserID: vi.fn(),
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
    'limitedHistory',
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
    'limitedHistory',
    'unlimitedHistory',
  ],
  expiresAt: '2026-07-16T00:00:00.000Z',
  checkedAt: '2026-06-16T00:00:00.000Z',
};

const mockedGetSubscriptionStatus = vi.mocked(getSubscriptionStatus);
const mockedValidateRevenueCatSubscription = vi.mocked(
  validateRevenueCatSubscription
);
const mockedGetSubscriptionManagementUrl = vi.mocked(
  getSubscriptionManagementUrl
);
const mockedIsRevenueCatAvailable = vi.mocked(isRevenueCatAvailable);
const mockedGetCurrentOffering = vi.mocked(getCurrentOffering);
const mockedFindPackageByProductId = vi.mocked(findPackageByProductId);
const mockedPurchasePackage = vi.mocked(purchasePackage);
const mockedRestoreRevenueCatPurchases = vi.mocked(restoreRevenueCatPurchases);
const mockedGetRevenueCatAppUserID = vi.mocked(getRevenueCatAppUserID);
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
    vi.clearAllMocks();
    mockedIsRevenueCatAvailable.mockReturnValue(true);
    mockedGetSubscriptionStatus.mockResolvedValue(freeStatus);
    mockedValidateRevenueCatSubscription.mockResolvedValue(premiumStatus);
    mockedGetSubscriptionManagementUrl.mockResolvedValue({ url: '' });
    mockedGetRevenueCatAppUserID.mockResolvedValue({ appUserID: 'user-1' });
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

  it('does not unlock Premium after purchase until backend validation returns Premium', async () => {
    mockedFindPackageByProductId.mockResolvedValue({
      product: { identifier: 'monthly' },
    } as Awaited<ReturnType<typeof findPackageByProductId>>);
    mockedValidateRevenueCatSubscription.mockResolvedValue(freeStatus);

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.purchasePlan('premium_monthly');

    expect(mockedPurchasePackage).toHaveBeenCalled();
    expect(mockedValidateRevenueCatSubscription).toHaveBeenCalledWith({
      provider: 'revenuecat',
      appUserID: 'user-1',
      productId: 'monthly',
      entitlementId: 'OurWeek Premium',
    });
    expect(result.status).toBe('cancelled');
    expect(result.snapshot.currentPlan).toBe('free');
    expect(result.snapshot.entitlements.premium.isActive).toBe(false);
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
    expect(mockedValidateRevenueCatSubscription).not.toHaveBeenCalled();
  });

  it('validates restored purchases through the backend', async () => {
    mockedValidateRevenueCatSubscription.mockResolvedValue(freeStatus);

    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.restorePurchases();

    expect(mockedRestoreRevenueCatPurchases).toHaveBeenCalled();
    expect(mockedValidateRevenueCatSubscription).toHaveBeenCalledWith({
      provider: 'revenuecat',
      appUserID: 'user-1',
      entitlementId: 'OurWeek Premium',
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

  it('validates after a paywall purchase result before unlocking Premium', async () => {
    const provider = createRevenueCatSubscriptionProvider();
    const result = await provider.presentPremiumPaywall?.();

    expect(mockedPresentPremiumPaywall).toHaveBeenCalled();
    expect(mockedValidateRevenueCatSubscription).toHaveBeenCalledWith({
      provider: 'revenuecat',
      appUserID: 'user-1',
      entitlementId: 'OurWeek Premium',
    });
    expect(result?.status).toBe('completed');
    expect(result?.snapshot.entitlements.premium.isActive).toBe(true);
  });
});
