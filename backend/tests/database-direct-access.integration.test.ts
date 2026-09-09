import { randomUUID } from 'node:crypto';

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createAnonClient,
  createAuthenticatedTestUser,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

export const PUBLIC_APPLICATION_TABLES = [
  'users',
  'sessions',
  'workspaces',
  'workspace_members',
  'workspace_invitations',
  'participants',
  'meetings',
  'tasks',
  'agreements',
  'task_review_decisions',
  'subscriptions',
  'calendar_connections',
  'calendar_events',
  'ai_summary_requests',
  'auth_identities',
  'password_reset_tokens',
  'assistant_settings',
  'assistant_recap_credit_reservations',
  'assistant_follow_ups',
  'calendar_preferences',
] as const;

const harmlessEmail = 'db-proof-denied@example.invalid';

function serviceRoleRpcCases() {
  const id = randomUUID();
  const at = new Date().toISOString();
  return [
    ['account_delete', { p_user_id: id, p_deleted_at: at }],
    ['workspace_update_active_member', {
      p_workspace_id: id, p_user_id: id, p_role: null, p_status: null,
    }],
    ['create_participant_invitation', {
      p_workspace_id: id,
      p_participant_id: id,
      p_email: harmlessEmail,
      p_email_normalized: harmlessEmail,
      p_role: 'viewer',
      p_token_hash: 'db-proof-denied',
      p_expires_at: at,
    }],
    ['revoke_participant_invitation', { p_workspace_id: id, p_invitation_id: id }],
    ['claim_ai_summary_generation_v3', {
      p_workspace_id: id,
      p_meeting_id: id,
      p_user_id: id,
      p_provider: 'openai',
      p_input_hash: 'db-proof-denied',
      p_effective_model: 'db-proof-model',
      p_prompt_version: 'db-proof-v1',
      p_user_limit: 1,
      p_workspace_limit: 1,
      p_window_seconds: 60,
    }],
    ['finalize_ai_summary_generation', {
      p_workspace_id: id,
      p_request_id: id,
      p_meeting_id: id,
      p_expected_server_revision: 1,
      p_generated_summary: {},
      p_completed_at: at,
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_total_tokens: 0,
    }],
    ['reconcile_abandoned_assistant_recap_requests', { p_workspace_id: id }],
    ['enqueue_background_job', {
      p_job: { type: 'db-proof-denied' },
      p_delay_seconds: 0,
    }],
    ['reserve_assistant_recap_credit', {
      p_workspace_id: id,
      p_ai_summary_request_id: id,
      p_allowance_period_ends_at: at,
      p_limit: 1,
    }],
    ['confirm_password_reset', {
      p_code_hash: 'db-proof-denied',
      p_password_hash: 'db-proof-denied',
      p_confirmed_at: at,
    }],
    ['link_google_auth_identity', {
      p_user_id: id,
      p_provider_subject: 'db-proof-denied',
      p_email: harmlessEmail,
      p_display_name: null,
      p_avatar_url: null,
    }],
  ] as const;
}

function expectPermissionDenied(error: PostgrestError | null) {
  expect(error).not.toBeNull();
  expect(
    error?.code === '42501'
    || error?.code === 'PGRST301'
    || /permission denied|not allowed/i.test(error?.message ?? ''),
  ).toBe(true);
}

async function proveTableDenial(client: SupabaseClient, table: string) {
  const key = table === 'workspace_members'
    || table === 'task_review_decisions'
    || table === 'assistant_settings'
    ? 'workspace_id'
    : 'id';
  const select = await client.from(table).select('*').limit(1);
  expectPermissionDenied(select.error);
  expect(select.data).toBeNull();

  const insert = await client.from(table).insert({ [key]: randomUUID() }).select();
  expectPermissionDenied(insert.error);
  expect(insert.data).toBeNull();

  const update = await client
    .from(table)
    .update({ [key]: randomUUID() })
    .eq(key, randomUUID())
    .select();
  expectPermissionDenied(update.error);
  expect(update.data).toBeNull();

  const remove = await client.from(table).delete().eq(key, randomUUID()).select();
  expectPermissionDenied(remove.error);
  expect(remove.data).toBeNull();
}

const describeConfigured = databaseEnvironment ? describe : describe.skip;

describeConfigured('direct database access denial', () => {
  let authenticated: Awaited<ReturnType<typeof createAuthenticatedTestUser>> | null = null;

  beforeAll(async () => {
    authenticated = await createAuthenticatedTestUser(
      databaseEnvironment!,
      'direct-access',
    );
  });

  afterAll(async () => {
    await authenticated?.cleanup();
  });

  it.each(PUBLIC_APPLICATION_TABLES)('denies anon CRUD on %s', async (table) => {
    await proveTableDenial(createAnonClient(databaseEnvironment!), table);
  });

  it.each(PUBLIC_APPLICATION_TABLES)(
    'denies authenticated CRUD on %s',
    async (table) => {
      await proveTableDenial(authenticated!.client, table);
    },
  );

  it.each(serviceRoleRpcCases())(
    'denies anon execute on %s',
    async (name, args) => {
      const result = await createAnonClient(databaseEnvironment!).rpc(name, args);
      expectPermissionDenied(result.error);
      expect(result.data).toBeNull();
    },
  );

  it.each(serviceRoleRpcCases())(
    'denies authenticated execute on %s',
    async (name, args) => {
      const result = await authenticated!.client.rpc(name, args);
      expectPermissionDenied(result.error);
      expect(result.data).toBeNull();
    },
  );
});
