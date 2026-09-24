import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260912120000_create_account_restore_rpc.sql',
);

describe('account restoration migration', () => {
  it('adds a transactional, service-role-only account restore RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.account_restore');
    expect(sql).toContain('for update of w, wm');
    expect(sql).toContain("set deleted_at = null");
    expect(sql).toContain("set status = 'active'");
    expect(sql).toContain("else 'adult_member'");
    expect(sql).toContain('revoke all on function public.account_restore(uuid) from public');
    expect(sql).toContain('grant execute on function public.account_restore(uuid) to service_role');
    expect(sql).not.toContain('update public.sessions');
    expect(sql).not.toContain('update public.calendar_connections');
  });
});
