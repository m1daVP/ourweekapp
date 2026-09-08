import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260908120000_add_explicit_google_identity_linking.sql',
  'utf8',
).toLowerCase();

describe('explicit Google identity linking migration', () => {
  it('fails closed when a user already has duplicate provider identities', () => {
    expect(sql).toContain('duplicate_auth_identities_for_user');
    expect(sql).toContain('group by provider, user_id');
    expect(sql).toContain('having count(*) > 1');
    expect(sql).toContain('auth_identities_provider_user_unique');
    expect(sql).toContain('unique (provider, user_id)');
  });

  it('serializes links and returns stable conflict outcomes', () => {
    expect(sql).toContain('for update');
    expect(sql).toContain("message = 'account_link_email_mismatch'");
    expect(sql).toContain("message = 'account_link_conflict'");
    expect(sql).toContain("message = 'google_already_linked'");
    expect(sql).toContain('when unique_violation then');
  });

  it('exposes the RPC only to the service role', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain(
      'revoke all on function public.link_google_auth_identity(uuid, text, text, text, text)',
    );
    expect(sql).toContain(
      'grant execute on function public.link_google_auth_identity(uuid, text, text, text, text)',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
