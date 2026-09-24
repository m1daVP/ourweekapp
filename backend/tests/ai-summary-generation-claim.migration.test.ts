import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260904120000_add_ai_summary_generation_claim.sql',
);

describe('AI summary generation claim migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('persists request-bound cache output and permits one pending generation identity', () => {
    expect(sql).toContain('add column if not exists generated_summary jsonb');
    expect(sql).toContain('ai_summary_requests_active_generation_unique_idx');
    expect(sql).toContain('workspace_id, meeting_id, input_hash');
    expect(sql).toContain("where status = 'pending' and input_hash is not null");
  });

  it('serializes claims and limits execution to the service role', () => {
    expect(sql).toContain('public.claim_ai_summary_generation');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
