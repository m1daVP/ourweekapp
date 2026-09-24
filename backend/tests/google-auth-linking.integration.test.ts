import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createServiceRoleClient,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

const describeLocal = databaseEnvironment?.target === 'local' ? describe : describe.skip;

function requireSuccess(error: { message: string } | null, operation: string) {
  if (error) {
    throw new Error(`Local Google linking fixture ${operation} failed.`);
  }
}

describeLocal('Google identity linking RPC', () => {
  const userIds: string[] = [];

  function client() {
    return createServiceRoleClient(databaseEnvironment!);
  }

  async function createUser(supabase: SupabaseClient, label: string) {
    const userId = randomUUID();
    const email = `google-link-${label}-${userId}@local.invalid`;
    requireSuccess((await supabase.from('users').insert({
      id: userId,
      email,
      email_normalized: email,
      display_name: `Google link ${label}`,
      password_hash: 'local-test-password-hash',
    })).error, 'user creation');
    userIds.push(userId);
    return { userId, email };
  }

  afterEach(async () => {
    const supabase = client();
    for (const userId of userIds.splice(0)) {
      requireSuccess(
        (await supabase.from('users').delete().eq('id', userId)).error,
        'user cleanup',
      );
    }
  });

  it('links idempotently and preserves the password credential', async () => {
    const supabase = client();
    const user = await createUser(supabase, 'success');
    const args = {
      p_user_id: user.userId,
      p_provider_subject: `subject-${randomUUID()}`,
      p_email: user.email,
      p_display_name: 'Linked User',
      p_avatar_url: null,
    };

    requireSuccess((await supabase.rpc('link_google_auth_identity', args)).error, 'first link');
    requireSuccess((await supabase.rpc('link_google_auth_identity', args)).error, 'idempotent link');

    const { data: identities, error: identityError } = await supabase
      .from('auth_identities')
      .select('provider,user_id')
      .eq('user_id', user.userId);
    requireSuccess(identityError, 'identity lookup');
    expect(identities).toEqual([{ provider: 'google', user_id: user.userId }]);

    const { data: storedUser, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', user.userId)
      .single();
    requireSuccess(userError, 'password lookup');
    expect(storedUser?.password_hash).toBe('local-test-password-hash');
  });

  it('rejects mismatched email and an identity owned by another user', async () => {
    const supabase = client();
    const first = await createUser(supabase, 'first');
    const second = await createUser(supabase, 'second');
    const subject = `subject-${randomUUID()}`;

    const mismatch = await supabase.rpc('link_google_auth_identity', {
      p_user_id: first.userId,
      p_provider_subject: subject,
      p_email: second.email,
      p_display_name: null,
      p_avatar_url: null,
    });
    expect(mismatch.error?.message).toContain('account_link_email_mismatch');

    requireSuccess((await supabase.rpc('link_google_auth_identity', {
      p_user_id: first.userId,
      p_provider_subject: subject,
      p_email: first.email,
      p_display_name: null,
      p_avatar_url: null,
    })).error, 'first user link');

    const conflict = await supabase.rpc('link_google_auth_identity', {
      p_user_id: second.userId,
      p_provider_subject: subject,
      p_email: second.email,
      p_display_name: null,
      p_avatar_url: null,
    });
    expect(conflict.error?.message).toContain('account_link_conflict');
  });
});
