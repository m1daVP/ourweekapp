import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  'supabase/migrations/20260629120000_create_google_auth_identities.sql',
  'utf8',
).toLowerCase();

describe('Google auth identity migration', () => {
  it('allows provider-only users without password hashes', () => {
    expect(migrationSql).toContain('alter column password_hash drop not null');
  });

  it('creates Google auth identities with subject uniqueness and user ownership', () => {
    expect(migrationSql).toContain('create table public.auth_identities');
    expect(migrationSql).toContain(
      'user_id uuid not null references public.users(id) on delete cascade',
    );
    expect(migrationSql).toContain(
      "constraint auth_identities_provider_check check (provider in ('google'))",
    );
    expect(migrationSql).toContain(
      'constraint auth_identities_provider_subject_unique unique (provider, provider_subject)',
    );
    expect(migrationSql).toContain(
      'create index auth_identities_user_id_idx on public.auth_identities (user_id)',
    );
  });
});
