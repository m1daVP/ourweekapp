import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createServiceRoleClient,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

const describeLocal = databaseEnvironment?.target === 'local' ? describe : describe.skip;

type ResetFixture = {
  userId: string;
  tokenId: string;
  codeHash: string;
  originalPasswordHash: string;
  activeSessionIds: string[];
  previouslyRevokedSessionId: string;
  originalRevokedAt: string;
};

function client() {
  return createServiceRoleClient(databaseEnvironment!);
}

function requireSuccess(error: { message: string } | null, operation: string) {
  if (error) {
    throw new Error(`Local password reset fixture ${operation} failed.`);
  }
}

async function createFixture(supabase: SupabaseClient): Promise<ResetFixture> {
  const userId = randomUUID();
  const tokenId = randomUUID();
  const activeSessionIds = [randomUUID(), randomUUID()];
  const previouslyRevokedSessionId = randomUUID();
  const email = `password-reset-${userId}@local.invalid`;
  const codeHash = `hmac-sha256:${randomUUID()}`;
  const originalPasswordHash = 'original-local-password-hash';
  const originalRevokedAt = '2026-09-01T10:00:00.000Z';

  requireSuccess(
    (
      await supabase.from('users').insert({
        id: userId,
        email,
        email_normalized: email,
        display_name: 'Password reset test user',
        password_hash: originalPasswordHash,
      })
    ).error,
    'user creation',
  );
  requireSuccess(
    (
      await supabase.from('password_reset_tokens').insert({
        id: tokenId,
        user_id: userId,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
    ).error,
    'token creation',
  );
  requireSuccess(
    (
      await supabase.from('sessions').insert([
        ...activeSessionIds.map((id, index) => ({
          id,
          user_id: userId,
          refresh_token_hash: `active-${index}-${randomUUID()}`,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })),
        {
          id: previouslyRevokedSessionId,
          user_id: userId,
          refresh_token_hash: `revoked-${randomUUID()}`,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          revoked_at: originalRevokedAt,
        },
      ])
    ).error,
    'session creation',
  );

  return {
    userId,
    tokenId,
    codeHash,
    originalPasswordHash,
    activeSessionIds,
    previouslyRevokedSessionId,
    originalRevokedAt,
  };
}

function confirmReset(
  supabase: SupabaseClient,
  fixture: ResetFixture,
  passwordHash: string,
) {
  return supabase.rpc('confirm_password_reset', {
    p_code_hash: fixture.codeHash,
    p_password_hash: passwordHash,
    p_confirmed_at: new Date().toISOString(),
  });
}

async function readFixture(supabase: SupabaseClient, fixture: ResetFixture) {
  const [userResult, tokenResult, sessionsResult] = await Promise.all([
    supabase
      .from('users')
      .select('password_hash,deleted_at')
      .eq('id', fixture.userId)
      .single(),
    supabase
      .from('password_reset_tokens')
      .select('consumed_at')
      .eq('id', fixture.tokenId)
      .single(),
    supabase
      .from('sessions')
      .select('id,revoked_at')
      .eq('user_id', fixture.userId),
  ]);

  requireSuccess(userResult.error, 'user lookup');
  requireSuccess(tokenResult.error, 'token lookup');
  requireSuccess(sessionsResult.error, 'session lookup');

  return {
    user: userResult.data,
    token: tokenResult.data,
    sessions: sessionsResult.data ?? [],
  };
}

describeLocal('atomic password reset RPC', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    const supabase = client();

    for (const userId of userIds.splice(0)) {
      requireSuccess(
        (await supabase.from('users').delete().eq('id', userId)).error,
        'user cleanup',
      );
    }
  });

  async function trackedFixture(supabase: SupabaseClient) {
    const fixture = await createFixture(supabase);
    userIds.push(fixture.userId);
    return fixture;
  }

  it('changes the password, consumes the token, and revokes every active session', async () => {
    const supabase = client();
    const fixture = await trackedFixture(supabase);
    const result = await confirmReset(
      supabase,
      fixture,
      'new-local-password-hash',
    );

    requireSuccess(result.error, 'confirmation');
    expect(result.data).toBe(true);

    const stored = await readFixture(supabase, fixture);
    expect(stored.user?.password_hash).toBe('new-local-password-hash');
    expect(stored.token?.consumed_at).toEqual(expect.any(String));

    const activeSessions = stored.sessions.filter((session) =>
      fixture.activeSessionIds.includes(session.id),
    );
    expect(activeSessions).toHaveLength(2);
    expect(activeSessions.every((session) => session.revoked_at !== null)).toBe(
      true,
    );
    const previouslyRevokedAt = stored.sessions.find(
      (session) => session.id === fixture.previouslyRevokedSessionId,
    )?.revoked_at;
    expect(Date.parse(previouslyRevokedAt!)).toBe(
      Date.parse(fixture.originalRevokedAt),
    );
  });

  it('allows exactly one concurrent confirmation and rejects later reuse', async () => {
    const fixture = await trackedFixture(client());
    const [first, second] = await Promise.all([
      confirmReset(client(), fixture, 'first-password-hash'),
      confirmReset(client(), fixture, 'second-password-hash'),
    ]);

    requireSuccess(first.error, 'first concurrent confirmation');
    requireSuccess(second.error, 'second concurrent confirmation');
    expect([first.data, second.data].sort()).toEqual([false, true]);

    const stored = await readFixture(client(), fixture);
    expect(['first-password-hash', 'second-password-hash']).toContain(
      stored.user?.password_hash,
    );
    expect(stored.token?.consumed_at).toEqual(expect.any(String));
    expect(
      stored.sessions
        .filter((session) => fixture.activeSessionIds.includes(session.id))
        .every((session) => session.revoked_at !== null),
    ).toBe(true);

    const reused = await confirmReset(client(), fixture, 'third-password-hash');
    requireSuccess(reused.error, 'token reuse');
    expect(reused.data).toBe(false);
  });

  it('rolls back token consumption when the user cannot be updated', async () => {
    const supabase = client();
    const fixture = await trackedFixture(supabase);
    const before = await readFixture(supabase, fixture);

    requireSuccess(
      (
        await supabase
          .from('users')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', fixture.userId)
      ).error,
      'user soft deletion',
    );

    const result = await confirmReset(
      supabase,
      fixture,
      'new-local-password-hash',
    );
    expect(result.error?.message).toContain('password_reset_user_not_found');

    const stored = await readFixture(supabase, fixture);
    expect(stored.user?.password_hash).toBe(fixture.originalPasswordHash);
    expect(stored.token?.consumed_at).toBeNull();
    expect(
      stored.sessions
        .map((session) => ({ id: session.id, revokedAt: session.revoked_at }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ).toEqual(
      before.sessions
        .map((session) => ({ id: session.id, revokedAt: session.revoked_at }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  });
});
