import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260607160000_scope_calendar_events_to_user.sql',
);

describe('calendar event user scoping migration', () => {
  it('removes unsafe rows and duplicates before enforcing uniqueness', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const deleteUnmatchedIndex = sql.indexOf('delete from public.calendar_events\nwhere user_id is null');
    const dedupeIndex = sql.indexOf('with ranked_calendar_events as');
    const notNullIndex = sql.indexOf('alter column user_id set not null');
    const uniqueIndex = sql.indexOf('calendar_events_workspace_user_provider_source_unique_idx');

    expect(deleteUnmatchedIndex).toBeGreaterThan(-1);
    expect(dedupeIndex).toBeGreaterThan(deleteUnmatchedIndex);
    expect(sql).toContain('partition by workspace_id, user_id, provider, source_type, source_id');
    expect(sql).toContain('order by updated_at desc, created_at desc, id desc');
    expect(sql).toContain('ranked.duplicate_rank > 1');
    expect(notNullIndex).toBeGreaterThan(dedupeIndex);
    expect(uniqueIndex).toBeGreaterThan(notNullIndex);
  });
});
