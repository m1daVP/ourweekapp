import { describe, expect, it } from 'vitest';

import { AiRepository } from '../src/modules/ai/ai.repository.js';
import {
  AuthRepository,
  isPremiumSubscriptionEffective,
} from '../src/modules/auth/auth.repository.js';
import { SessionsRepository } from '../src/modules/auth/sessions.repository.js';
import type { SupabaseRepositoryClient } from '../src/shared/repositories/index.js';

type Call = {
  method: string;
  args: unknown[];
};

const activeSessionRow = {
  id: 'session-1',
  user_id: 'user-1',
  refresh_token_hash: 'next-hash',
  device_label: null,
  created_at: '2026-06-06T10:00:00.000Z',
  expires_at: '2026-07-06T10:00:00.000Z',
  revoked_at: null,
  last_used_at: '2026-06-06T10:01:00.000Z',
};

class FakeSessionQuery {
  constructor(
    private readonly calls: Call[],
    private readonly result: { data: unknown; error: unknown },
  ) {}

  update(value: unknown) {
    this.calls.push({ method: 'update', args: [value] });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ method: 'eq', args: [column, value] });
    return this;
  }

  is(column: string, value: unknown) {
    this.calls.push({ method: 'is', args: [column, value] });
    return this;
  }

  gt(column: string, value: unknown) {
    this.calls.push({ method: 'gt', args: [column, value] });
    return this;
  }

  select(columns: string) {
    this.calls.push({ method: 'select', args: [columns] });
    return this;
  }

  maybeSingle<T>() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve({
      data: this.result.data as T | null,
      error: this.result.error,
    });
  }
}

class FakeCountQuery {
  constructor(
    private readonly calls: Call[],
    private readonly result: { count: number | null; error: unknown },
  ) {}

  select(columns: string, options: unknown) {
    this.calls.push({ method: 'select', args: [columns, options] });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ method: 'eq', args: [column, value] });
    return this;
  }

  gte(column: string, value: unknown) {
    this.calls.push({ method: 'gte', args: [column, value] });
    return this;
  }

  then<TResult1 = { count: number | null; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { count: number | null; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createSessionClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      return new FakeSessionQuery(calls, result);
    },
  } as unknown as SupabaseRepositoryClient;

  return { calls, client };
}

function createCountClient(result: { count: number | null; error: unknown }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      return new FakeCountQuery(calls, result);
    },
  } as unknown as SupabaseRepositoryClient;

  return { calls, client };
}

describe('repository helpers', () => {
  it('uses an explicit premium status allowlist', () => {
    const now = new Date('2026-06-06T00:00:00.000Z');

    expect(
      isPremiumSubscriptionEffective(
        { plan_type: 'premium', status: 'active', expires_at: null },
        now,
      ),
    ).toBe(true);
    expect(
      isPremiumSubscriptionEffective(
        { plan_type: 'premium', status: 'trialing', expires_at: null },
        now,
      ),
    ).toBe(true);
    expect(
      isPremiumSubscriptionEffective(
        { plan_type: 'premium', status: 'grace_period', expires_at: null },
        now,
      ),
    ).toBe(true);
    expect(
      isPremiumSubscriptionEffective(
        { plan_type: 'premium', status: 'paused', expires_at: null },
        now,
      ),
    ).toBe(false);
    expect(
      isPremiumSubscriptionEffective(
        {
          plan_type: 'premium',
          status: 'active',
          expires_at: '2026-06-05T23:59:59.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('maps active auth repository Supabase errors to safe ApiError values', async () => {
    const { client } = createSessionClient({
      data: null,
      error: {
        code: 'PGRST999',
        message: 'raw database message',
        details: 'raw details',
        hint: null,
      },
    });
    const repository = new AuthRepository(client);

    await expect(repository.findActiveUser('user-1')).rejects.toMatchObject({
      statusCode: 500,
      code: 'auth_user_lookup_failed',
      details: { databaseCode: 'PGRST999' },
    });
  });

  it('rotates sessions only when current hash, active status, and expiry match', async () => {
    const now = new Date('2026-06-06T10:00:00.000Z');
    const { calls, client } = createSessionClient({ data: activeSessionRow, error: null });
    const repository = new SessionsRepository(client);

    const result = await repository.rotateSessionRefreshToken({
      sessionId: 'session-1',
      currentRefreshTokenHash: 'current-hash',
      refreshTokenHash: 'next-hash',
      expiresAt: '2026-07-06T10:00:00.000Z',
      lastUsedAt: '2026-06-06T10:01:00.000Z',
      now,
    });

    expect(result.refreshTokenHash).toBe('next-hash');
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'from', args: ['sessions'] },
        { method: 'eq', args: ['id', 'session-1'] },
        { method: 'eq', args: ['refresh_token_hash', 'current-hash'] },
        { method: 'is', args: ['revoked_at', null] },
        { method: 'gt', args: ['expires_at', now.toISOString()] },
        { method: 'maybeSingle', args: [] },
      ]),
    );
  });

  it('returns invalid_session when session rotation updates no row', async () => {
    const { client } = createSessionClient({ data: null, error: null });
    const repository = new SessionsRepository(client);

    await expect(
      repository.rotateSessionRefreshToken({
        sessionId: 'session-1',
        currentRefreshTokenHash: 'stale-hash',
        refreshTokenHash: 'next-hash',
        expiresAt: '2026-07-06T10:00:00.000Z',
        lastUsedAt: '2026-06-06T10:01:00.000Z',
        now: new Date('2026-06-06T10:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'invalid_session' });
  });

  it('scopes user AI summary request counts by workspace', async () => {
    const { calls, client } = createCountClient({ count: 2, error: null });
    const repository = new AiRepository(client);

    const count = await repository.countRecentSummaryRequestsForUserInWorkspace(
      'workspace-1',
      'user-1',
      '2026-06-06T00:00:00.000Z',
    );

    expect(count).toBe(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'from', args: ['ai_summary_requests'] },
        { method: 'eq', args: ['workspace_id', 'workspace-1'] },
        { method: 'eq', args: ['user_id', 'user-1'] },
        { method: 'gte', args: ['created_at', '2026-06-06T00:00:00.000Z'] },
      ]),
    );
  });
});
