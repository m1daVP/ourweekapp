import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  isRevenueCatAvailable: vi.fn(),
  createBackendSubscriptionProvider: vi.fn(),
  createRevenueCatSubscriptionProvider: vi.fn(),
  backendGetCurrentPlan: vi.fn(),
  revenueCatGetCurrentPlan: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/subscription/services/revenueCatService', () => ({
  isRevenueCatAvailable: mocks.isRevenueCatAvailable,
}));

vi.mock('@/features/subscription/services/backendSubscriptionProvider', () => ({
  createBackendSubscriptionProvider: mocks.createBackendSubscriptionProvider,
}));

vi.mock(
  '@/features/subscription/services/revenueCatSubscriptionProvider',
  () => ({
    createRevenueCatSubscriptionProvider:
      mocks.createRevenueCatSubscriptionProvider,
  })
);

async function loadSubscriptionService() {
  vi.resetModules();

  return import('@/features/subscription/services/subscriptionService');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isNativePlatform.mockReturnValue(false);
  mocks.isRevenueCatAvailable.mockReturnValue(false);
  mocks.createBackendSubscriptionProvider.mockReturnValue({
    getCurrentPlan: mocks.backendGetCurrentPlan,
  });
  mocks.createRevenueCatSubscriptionProvider.mockReturnValue({
    getCurrentPlan: mocks.revenueCatGetCurrentPlan,
  });
});

describe('subscriptionsService provider selection', () => {
  it('uses the backend provider in browser development', async () => {
    const { subscriptionsService } = await loadSubscriptionService();

    subscriptionsService.getCurrentPlan();

    expect(mocks.createBackendSubscriptionProvider).toHaveBeenCalledOnce();
    expect(mocks.createRevenueCatSubscriptionProvider).not.toHaveBeenCalled();
  });

  it('uses RevenueCat on native platforms', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isRevenueCatAvailable.mockReturnValue(true);
    const { subscriptionsService } = await loadSubscriptionService();

    subscriptionsService.getCurrentPlan();

    expect(mocks.createRevenueCatSubscriptionProvider).toHaveBeenCalledOnce();
    expect(mocks.createBackendSubscriptionProvider).not.toHaveBeenCalled();
  });

  it('fails clearly when native RevenueCat configuration is missing', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const { subscriptionsService } = await loadSubscriptionService();

    expect(() => subscriptionsService.getCurrentPlan()).toThrow(
      'upgrade.billingUnavailable'
    );
    expect(mocks.createBackendSubscriptionProvider).not.toHaveBeenCalled();
  });
});
