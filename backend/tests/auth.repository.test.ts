import { describe, expect, it } from 'vitest';

import { isPremiumSubscriptionEffective } from '../src/modules/auth/auth.repository.js';

describe('auth.repository', () => {
  it('grants premium only for explicitly active subscription statuses', () => {
    const now = new Date('2026-06-06T12:00:00Z');

    for (const status of ['active', 'trialing', 'grace_period']) {
      expect(
        isPremiumSubscriptionEffective(
          {
            plan_type: 'premium',
            status,
            expires_at: '2026-06-07T12:00:00Z',
          },
          now,
        ),
      ).toBe(true);
    }

    for (const status of ['unknown', 'paused', 'cancelled', 'expired']) {
      expect(
        isPremiumSubscriptionEffective(
          {
            plan_type: 'premium',
            status,
            expires_at: '2026-06-07T12:00:00Z',
          },
          now,
        ),
      ).toBe(false);
    }
  });

  it('does not grant premium for expired or free plans', () => {
    const now = new Date('2026-06-06T12:00:00Z');

    expect(
      isPremiumSubscriptionEffective(
        {
          plan_type: 'premium',
          status: 'active',
          expires_at: '2026-06-06T11:59:59Z',
        },
        now,
      ),
    ).toBe(false);
    expect(
      isPremiumSubscriptionEffective(
        {
          plan_type: 'free',
          status: 'active',
          expires_at: null,
        },
        now,
      ),
    ).toBe(false);
  });
});
