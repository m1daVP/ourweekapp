import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260825140000_add_household_insights_indexes.sql',
);

describe('household insights migration', () => {
  it('adds only the partial indexes used by household insight period queries', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain(
      'create index insights_completed_meetings_workspace_completed_idx',
    );
    expect(sql).toContain("where deleted_at is null and status = 'completed'");
    expect(sql).toContain('create index insights_active_tasks_workspace_created_idx');
    expect(sql).toContain('create index insights_active_agreements_workspace_created_idx');
    expect(sql).not.toContain('alter table public.');
    expect(sql).not.toContain('update public.');
    expect(sql).not.toContain('delete from public.');
  });
});
