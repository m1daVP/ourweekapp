import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql';

describe('atomic password reset migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('locks and validates one eligible reset token', () => {
    expect(sql).toContain(
      'create or replace function public.confirm_password_reset',
    );
    expect(sql).toContain('returns boolean');
    expect(sql).toContain('from public.password_reset_tokens');
    expect(sql).toContain('code_hash = p_code_hash');
    expect(sql).toContain('consumed_at is null');
    expect(sql).toContain('expires_at > p_confirmed_at');
    expect(sql).toContain('for update');
    expect(sql).toContain('return false');
  });

  it('consumes the token, changes the password, and revokes sessions together', () => {
    expect(sql).toContain('update public.password_reset_tokens');
    expect(sql).toContain('set consumed_at = p_confirmed_at');
    expect(sql).toContain('update public.users');
    expect(sql).toContain('set password_hash = p_password_hash');
    expect(sql).toContain('and deleted_at is null');
    expect(sql).toContain("message = 'password_reset_user_not_found'");
    expect(sql).toContain('update public.sessions');
    expect(sql).toContain('set revoked_at = p_confirmed_at');
    expect(sql).toContain('and revoked_at is null');
    expect(sql).toContain('return true');
  });

  it('allows execution only through the backend service role', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain(
      'revoke all on function public.confirm_password_reset(text, text, timestamptz)',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain(
      'grant execute on function public.confirm_password_reset(text, text, timestamptz)',
    );
    expect(sql).toContain('to service_role');
  });
});
