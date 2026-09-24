import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260905130000_add_atomic_ai_summary_rate_limit_claim.sql',
);

describe('AI summary rate-limit claim migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates a versioned, atomic claim RPC with the approved policy inputs', () => {
    expect(sql).toContain('public.claim_ai_summary_generation_v3');
    expect(sql).toContain('p_user_limit integer');
    expect(sql).toContain('p_workspace_limit integer');
    expect(sql).toContain('p_window_seconds integer');
    expect(sql).toContain("status in ('pending', 'completed')");
    expect(sql).toContain("'rate_limited'");
    expect(sql).toContain('rate_limit_reset_at');
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))");
  });

  it('restricts the RPC to the service role without removing older claim RPCs', () => {
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('drop function public.claim_ai_summary_generation_v2');
  });
});
