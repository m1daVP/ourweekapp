import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSubscriptionStore } from '../subscription';
import { subscriptionsService } from '@/features/subscription/services/subscriptionService';
import { createSubscriptionSnapshotFromStatus } from '@/features/subscription/services/backendSubscriptionProvider';
import type {
  SubscriptionActionResult,
  SubscriptionSnapshot,
} from '@/features/subscription/types';

vi.mock('@/features/subscription/services/subscriptionService', () => ({
  subscriptionsService: {
    getCurrentPlan: vi.fn(),
    getAvailablePlans: vi.fn(),
    purchasePlan: vi.fn(),
    restorePurchases: vi.fn(),
    presentPremiumPaywall: vi.fn(),
    refreshCustomerInfo: vi.fn(),
  },
}));
vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

function snapshot(canGenerate = true): SubscriptionSnapshot {
  return createSubscriptionSnapshotFromStatus({
    planType: 'free',
    provider: null,
    enabledFeatures: [],
    expiresAt: null,
    checkedAt: '2026-09-04T10:00:00.000Z',
    assistantRecap: {
      limit: 3,
      used: 0,
      remaining: 3,
      periodEndsAt: null,
      canGenerate,
    },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  vi.mocked(subscriptionsService.getCurrentPlan).mockResolvedValue(snapshot());
  vi.mocked(subscriptionsService.getAvailablePlans).mockResolvedValue([]);
});

describe('recap allowance state', () => {
  it('runs a requested allowance refresh after an in-flight purchase settles', async () => {
    const store = useSubscriptionStore();
    const purchase = deferred<SubscriptionActionResult>();
    vi.mocked(subscriptionsService.purchasePlan).mockReturnValueOnce(
      purchase.promise
    );
    vi.mocked(subscriptionsService.getCurrentPlan).mockResolvedValueOnce(
      snapshot(false)
    );
    const pending = store.purchasePlan('premium_monthly');
    store.invalidateAssistantRecap();
    await store.refreshCurrentPlan();
    expect(store.canGenerateAssistantRecap).toBe(false);
    purchase.resolve({ status: 'completed', snapshot: snapshot() });
    await pending;
    expect(subscriptionsService.getCurrentPlan).toHaveBeenCalledOnce();
    expect(store.canGenerateAssistantRecap).toBe(false);
    expect(store.isCheckingRecapAllowance).toBe(false);
  });

  it('lets a purchase supersede an old read without leaving loading stuck', async () => {
    const store = useSubscriptionStore();
    const read = deferred<SubscriptionSnapshot>();
    vi.mocked(subscriptionsService.getCurrentPlan).mockReturnValueOnce(
      read.promise
    );
    const pending = store.refreshCurrentPlan();
    vi.mocked(subscriptionsService.purchasePlan).mockResolvedValueOnce({
      status: 'completed',
      snapshot: snapshot(false),
    });
    await store.purchasePlan('premium_monthly');
    read.resolve(snapshot());
    await pending;
    expect(store.canGenerateAssistantRecap).toBe(false);
    expect(store.isCheckingRecapAllowance).toBe(false);
  });
  it('starts unavailable and never falls back to Premium', () => {
    const store = useSubscriptionStore();
    expect(store.canGenerateAssistantRecap).toBe(false);
    store.applySnapshot({
      ...snapshot(),
      currentPlan: 'premium',
      assistantRecap: null,
    });
    expect(store.canGenerateAssistantRecap).toBe(false);
  });

  it('maps Free allowance and respects backend role denial even with credits', async () => {
    const store = useSubscriptionStore();
    await store.refreshCurrentPlan();
    expect(store.canGenerateAssistantRecap).toBe(true);
    store.applySnapshot(snapshot(false));
    expect(store.assistantRecap?.remaining).toBe(3);
    expect(store.canGenerateAssistantRecap).toBe(false);
  });

  it('blocks during refresh and invalidates on failure without discarding plan state', async () => {
    const store = useSubscriptionStore();
    store.applySnapshot({ ...snapshot(), currentPlan: 'premium' });
    const pending = deferred<SubscriptionSnapshot>();
    vi.mocked(subscriptionsService.getCurrentPlan).mockReturnValueOnce(
      pending.promise
    );
    const refresh = store.refreshCurrentPlan();
    expect(store.isCheckingRecapAllowance).toBe(true);
    expect(store.canGenerateAssistantRecap).toBe(false);
    pending.reject(new Error('offline'));
    await refresh;
    expect(store.assistantRecap).toBeNull();
    expect(store.currentPlan).toBe('premium');
    expect(store.errorMessage).toBe('offline');
    expect(store.isCheckingRecapAllowance).toBe(false);
  });

  it.each([
    'initializeSubscriptions',
    'refreshCurrentPlan',
    'refreshCustomerInfo',
  ] as const)('ignores late %s results after session reset', async (action) => {
    const store = useSubscriptionStore();
    const pending = deferred<SubscriptionSnapshot>();
    vi.mocked(subscriptionsService.getCurrentPlan).mockReturnValueOnce(
      pending.promise
    );
    vi.mocked(subscriptionsService.refreshCustomerInfo).mockImplementationOnce(
      async () => ({ status: 'completed', snapshot: await pending.promise })
    );
    const refresh = store[action]();
    store.$reset();
    pending.resolve(snapshot());
    await refresh;
    expect(store.assistantRecap).toBeNull();
    expect(store.isCheckingRecapAllowance).toBe(false);
  });

  it.each([
    'purchasePlan',
    'restorePurchases',
    'presentPremiumPaywall',
  ] as const)('ignores late %s after reset', async (action) => {
    const store = useSubscriptionStore();
    const pending = deferred<SubscriptionActionResult>();
    vi.mocked(subscriptionsService[action]).mockReturnValueOnce(
      pending.promise
    );
    const result =
      action === 'purchasePlan'
        ? store.purchasePlan('premium_monthly')
        : store[action]();
    expect(store.isCheckingRecapAllowance).toBe(true);
    store.$reset();
    pending.resolve({ status: 'completed', snapshot: snapshot() });
    expect(await result).toBe(false);
    expect(store.assistantRecap).toBeNull();
    expect(store.isCheckingRecapAllowance).toBe(false);
  });

  it('does not let an older read or error overwrite a newer allowance', async () => {
    const store = useSubscriptionStore();
    const older = deferred<SubscriptionSnapshot>();
    vi.mocked(subscriptionsService.getCurrentPlan)
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(snapshot(false));
    const first = store.refreshCurrentPlan();
    await store.refreshCurrentPlan();
    older.resolve(snapshot());
    await first;
    expect(store.canGenerateAssistantRecap).toBe(false);
    expect(store.isCheckingRecapAllowance).toBe(false);
  });

  it('does not clear a newer loading flag when the older read finishes', async () => {
    const store = useSubscriptionStore();
    const older = deferred<SubscriptionSnapshot>();
    const newer = deferred<SubscriptionSnapshot>();
    vi.mocked(subscriptionsService.getCurrentPlan)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const first = store.refreshCurrentPlan();
    const second = store.refreshCurrentPlan();
    older.reject(new Error('old error'));
    await first;
    expect(store.isCheckingRecapAllowance).toBe(true);
    expect(store.errorMessage).toBe('');
    newer.resolve(snapshot());
    await second;
    expect(store.canGenerateAssistantRecap).toBe(true);
  });
});
