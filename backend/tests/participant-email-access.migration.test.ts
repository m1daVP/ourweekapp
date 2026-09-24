import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../supabase/migrations/20260826180000_add_participant_identity_invitations.sql',
  import.meta.url,
);

describe('participant email access migration', () => {
  it('adds participant identity and invitation lifecycle primitives', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('add column email text');
    expect(sql).toContain('add column email_normalized text');
    expect(sql).toContain('add column user_id uuid');
    expect(sql).toContain('add column participant_id uuid');
    expect(sql).toContain('participants_workspace_email_normalized_unique_idx');
    expect(sql).toContain('create or replace function public.create_participant_invitation');
    expect(sql).toContain('create or replace function public.accept_participant_invitation');
    expect(sql).toContain('create or replace function public.revoke_participant_invitation');
    expect(sql).toContain(
      'create or replace function public.link_existing_workspace_member_to_participant',
    );
  });
});
