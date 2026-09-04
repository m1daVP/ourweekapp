import { describe, expect, it, vi } from 'vitest';
import { createSubscriptionSnapshotFromStatus } from '../backendSubscriptionProvider';
import type { SubscriptionStatusDto } from '@/shared/api/subscriptionsApi';

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

const status: SubscriptionStatusDto = {
  planType: 'free',
  provider: null,
  enabledFeatures: [],
  expiresAt: null,
  checkedAt: '2026-09-04T10:00:00.000Z',
};

describe('backend recap allowance mapping', () => {
  it.each([
    ['free', 3, 0, 3, true, null],
    ['free', 3, 3, 0, false, null],
    ['premium', 30, 2, 28, true, '2026-10-04T10:00:00.000Z'],
    ['premium', 30, 30, 0, false, '2026-10-04T10:00:00.000Z'],
    ['free', 3, 0, 3, false, null],
  ] as const)(
    'preserves %s allowance (%s/%s/%s, permitted=%s)',
    (planType, limit, used, remaining, canGenerate, periodEndsAt) => {
      const assistantRecap = {
        limit,
        used,
        remaining,
        canGenerate,
        periodEndsAt,
      };
      const snapshot = createSubscriptionSnapshotFromStatus({
        ...status,
        planType,
        assistantRecap,
      });
      expect(snapshot.assistantRecap).toEqual(assistantRecap);
      expect(snapshot.entitlements.premium).not.toHaveProperty(
        'assistantRecap'
      );
    }
  );

  it.each(['free', 'premium'] as const)(
    'keeps absent %s allowance unavailable',
    (planType) => {
      expect(
        createSubscriptionSnapshotFromStatus({ ...status, planType })
          .assistantRecap
      ).toBeNull();
    }
  );
});
