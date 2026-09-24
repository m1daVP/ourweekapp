import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260904150000_add_ai_summary_generation_finalization.sql',
);

describe('AI summary generation finalization migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('atomically writes the meeting, completed request, and settled credit', () => {
    expect(sql).toContain('public.finalize_ai_summary_generation');
    expect(sql).toContain('update public.meetings');
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain("state = 'settled'");
    expect(sql).toContain('generated_summary = p_generated_summary');
    expect(sql).toContain('input_tokens = p_input_tokens');
    expect(sql).toContain('output_tokens = p_output_tokens');
    expect(sql).toContain('total_tokens = p_total_tokens');
  });

  it('uses a workspace lock, source revision, and service-role-only access', () => {
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))');
    expect(sql).toContain('and server_revision = p_expected_server_revision');
    expect(sql).toContain('deleted_at is null');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });

  it('keeps repeated and failed finalization attempts safe', () => {
    expect(sql).toContain("v_request.status = 'completed'");
    expect(sql).toContain("v_request.status <> 'pending'");
    expect(sql).toContain("v_credit.state <> 'reserved'");
    expect(sql).toContain("'revision_conflict'");
    expect(sql).not.toContain('commit;');
    expect(sql).not.toContain('rollback;');
  });

  it('reconciles a stale pending request whose credit was released before audit cleanup', () => {
    const recoverySql = sql.slice(
      sql.lastIndexOf('create or replace function public.reconcile_abandoned_assistant_recap_requests'),
    );

    expect(recoverySql).toContain("credit.state = 'settled'");
    expect(recoverySql).toContain("credit.state = 'reserved'");
    expect(recoverySql).not.toContain("credit.state <> 'reserved'");
  });
});
