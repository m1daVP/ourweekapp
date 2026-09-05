import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260905120000_add_ai_summary_request_model_audit.sql',
);

describe('AI summary request model audit migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('adds nullable nonblank audit fields without altering existing history', () => {
    expect(sql).toContain('add column if not exists effective_model text');
    expect(sql).toContain('add column if not exists prompt_version text');
    expect(sql).toContain('ai_summary_requests_effective_model_not_blank');
    expect(sql).toContain('ai_summary_requests_prompt_version_not_blank');
  });

  it('creates a service-role-only v2 claim RPC without removing the original RPC', () => {
    expect(sql).toContain('public.claim_ai_summary_generation_v2');
    expect(sql).toContain('p_effective_model text');
    expect(sql).toContain('p_prompt_version text');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('drop function public.claim_ai_summary_generation(');
  });

  it('persists model audit values on the pending request and returns them for cache reads', () => {
    expect(sql).toContain('effective_model,');
    expect(sql).toContain('prompt_version');
    expect(sql).toContain('p_effective_model');
    expect(sql).toContain('p_prompt_version');
  });
});
