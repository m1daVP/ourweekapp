import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260909120000_harden_public_function_privileges.sql',
  ),
  'utf8',
);

describe('public function privilege hardening migration', () => {
  it('removes existing public client-role execute grants', () => {
    expect(migration).toContain(
      'revoke execute on all functions in schema public from public, anon, authenticated',
    );
  });

  it('retains backend service-role execution', () => {
    expect(migration).toContain(
      'grant execute on all functions in schema public to service_role',
    );
  });

  it('prevents future migration-created functions from inheriting client execution', () => {
    expect(migration).toMatch(
      /alter default privileges in schema public\s+revoke execute on functions from public, anon, authenticated/i,
    );
  });
});

