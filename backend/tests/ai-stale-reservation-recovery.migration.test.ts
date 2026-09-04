import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql',
);

describe('AI stale recap recovery migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('reconciles stale pending requests with only their linked stale reservations', () => {
    expect(sql).toContain('public.reconcile_abandoned_assistant_recap_requests');
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("'ai_summary_request_abandoned'");
    expect(sql).toContain('request.status = \'pending\'');
    expect(sql).toContain('credit.ai_summary_request_id = request.id');
    expect(sql).toContain("credit.state <> 'reserved'");
    expect(sql).toContain("credit.state = 'reserved'");
    expect(sql).toContain('credit.ai_summary_request_id = recovered_requests.id');
    expect(sql).not.toContain('delete from public.ai_summary_requests');
  });

  it('uses workspace serialization and restricts recovery to the service role', () => {
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).toContain(
      'perform public.reconcile_abandoned_assistant_recap_requests(p_workspace_id)',
    );
  });
});
