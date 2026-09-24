import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260607143100_create_account_delete_rpc.sql',
);

describe('account deletion migration', () => {
  it('keeps account deletion in one idempotent RPC with ownership and token cleanup', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.account_delete');
    expect(sql).toContain('for update');
    expect(sql).toContain('access_token_encrypted = null');
    expect(sql).toContain('refresh_token_encrypted = null');
    expect(sql).toContain("wm.role in ('owner', 'adult_member')");
    expect(sql).toContain('set owner_id = replacement_owner_id');
    expect(sql).toContain('set deleted_at = coalesce(deleted_at, p_deleted_at)');
    expect(sql).toContain('set revoked_at = coalesce(revoked_at, p_deleted_at)');
  });
});
