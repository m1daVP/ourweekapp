import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260825120000_create_premium_assistant_schema.sql',
);

describe('premium assistant migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates workspace-scoped settings, credit reservations, and follow-ups', () => {
    expect(sql).toContain('create table public.assistant_settings');
    expect(sql).toContain('create table public.assistant_recap_credit_reservations');
    expect(sql).toContain('create table public.assistant_follow_ups');
    expect(sql).toContain("check (state in ('reserved', 'settled', 'released'))");
    expect(sql).toContain("check (state in ('open', 'resolved', 'snoozed', 'carry_to_next_meeting'))");
    expect(sql).toContain('assistant_follow_ups_active_source_unique_idx');
  });

  it('keeps agreement responsibility additive and workspace scoped', () => {
    expect(sql).toContain('add column if not exists responsible_user_id uuid');
    expect(sql).toContain('foreign key (workspace_id, responsible_user_id)');
    expect(sql).toContain('references public.workspace_members(workspace_id, user_id)');
  });

  it('uses service-role-only, security-definer credit RPCs', () => {
    expect(sql).toContain('public.reserve_assistant_recap_credit');
    expect(sql).toContain('public.settle_assistant_recap_credit');
    expect(sql).toContain('public.release_assistant_recap_credit');
    expect(sql.match(/security definer/g)).toHaveLength(3);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(3);
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql.match(/to service_role/g)).toHaveLength(3);
  });

  it('enables RLS and indexes the inbox without exposing policies', () => {
    expect(sql).toContain('alter table public.assistant_settings enable row level security');
    expect(sql).toContain('alter table public.assistant_recap_credit_reservations enable row level security');
    expect(sql).toContain('alter table public.assistant_follow_ups enable row level security');
    expect(sql).toContain('assistant_follow_ups_workspace_due_idx');
    expect(sql).not.toContain('create policy');
  });
});
