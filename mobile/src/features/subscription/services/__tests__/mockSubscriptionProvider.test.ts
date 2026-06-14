import { describe, expect, it } from 'vitest';
import { createMockSubscriptionProvider } from '@/features/subscription/services/mockSubscriptionProvider';

describe('createMockSubscriptionProvider', () => {
  it('never returns an active Premium entitlement', async () => {
    const provider = createMockSubscriptionProvider();

    const snapshot = await provider.getCurrentPlan();

    expect(snapshot.currentPlan).toBe('free');
    expect(snapshot.entitlements.premium).toMatchObject({
      isActive: false,
      unlockedFeatures: [],
      verification: 'none',
    });
  });

  it('does not complete local Premium purchases', async () => {
    const provider = createMockSubscriptionProvider();

    const result = await provider.purchasePlan('premium_monthly');

    expect(result.status).toBe('not_supported');
    expect(result.snapshot.currentPlan).toBe('free');
    expect(result.snapshot.entitlements.premium.isActive).toBe(false);
  });

  it('does not restore local mock Premium state', async () => {
    const provider = createMockSubscriptionProvider();

    const result = await provider.restorePurchases();

    expect(result.status).toBe('not_supported');
    expect(result.snapshot.currentPlan).toBe('free');
    expect(result.snapshot.entitlements.premium.isActive).toBe(false);
  });
});
