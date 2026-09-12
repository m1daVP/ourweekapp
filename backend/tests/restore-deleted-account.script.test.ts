import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { restoreDeletedAccount } from '../scripts/restore-deleted-account.js';

describe('restore-deleted-account script', () => {
  it('normalizes an email and restores its deleted account', async () => {
    const userQuery = {
      eq: vi.fn(() => userQuery),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'user-1', deleted_at: '2026-09-12T10:00:00.000Z' },
        error: null,
      })),
      select: vi.fn(() => userQuery),
    };
    const restoreQuery = {
      returns: vi.fn(async () => ({
        data: [{ restored_workspace_count: 1, restored_membership_count: 2 }],
        error: null,
      })),
    };
    const rpc = vi.fn(() => restoreQuery);
    const supabase = {
      from: vi.fn(() => userQuery),
      rpc,
    } as unknown as SupabaseClient;

    await expect(restoreDeletedAccount(supabase, '  OWNER@EXAMPLE.COM ')).resolves.toEqual({
      restoredWorkspaceCount: 1,
      restoredMembershipCount: 2,
    });
    expect(userQuery.eq).toHaveBeenCalledWith('email_normalized', 'owner@example.com');
    expect(rpc).toHaveBeenCalledWith('account_restore', { p_user_id: 'user-1' });
  });

  it('does not call the RPC for an active or unknown account', async () => {
    const userQuery = {
      eq: vi.fn(() => userQuery),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'user-1', deleted_at: null },
        error: null,
      })),
      select: vi.fn(() => userQuery),
    };
    const rpc = vi.fn();
    const supabase = {
      from: vi.fn(() => userQuery),
      rpc,
    } as unknown as SupabaseClient;

    await expect(restoreDeletedAccount(supabase, 'owner@example.com'))
      .rejects.toThrow('No deleted account matches that email address.');
    expect(rpc).not.toHaveBeenCalled();
  });
});
