import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260909130000_fix_ai_rpc_column_ambiguity.sql',
  ),
  'utf8',
);

describe('AI RPC column ambiguity migration', () => {
  it.each([
    'claim_ai_summary_generation',
    'claim_ai_summary_generation_v2',
    'claim_ai_summary_generation_v3',
    'finalize_ai_summary_generation',
  ])('replaces %s without changing its signature', (name) => {
    expect(migration).toContain(`create or replace function public.${name}(`);
  });

  it('uses deterministic column resolution in all four functions', () => {
    expect(migration.match(/#variable_conflict use_column/g)).toHaveLength(4);
  });

  it('retains service-role-only execution grants', () => {
    expect(migration.match(/from public, anon, authenticated/g)).toHaveLength(4);
    expect(migration.match(/to service_role/g)).toHaveLength(4);
  });
});
