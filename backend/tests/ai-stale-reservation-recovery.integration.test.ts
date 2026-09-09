import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createServiceRoleClient,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

const describeLocal = databaseEnvironment?.target === 'local' ? describe : describe.skip;

type RecoveryFixture = {
  userId: string;
  workspaceId: string;
  otherWorkspaceId: string;
  meetingId: string;
  requests: {
    freeStale: string;
    premiumStale: string;
    active: string;
    settled: string;
    otherWorkspaceStale: string;
  };
};

function requireSuccess(error: { code?: string; message: string } | null, operation: string) {
  if (error) {
    throw new Error(`Local AI stale recovery fixture ${operation} failed (${error.code ?? 'unknown'}: ${error.message}).`);
  }
}

async function createFixture(client: SupabaseClient): Promise<RecoveryFixture> {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const meetingId = randomUUID();
  const otherMeetingId = randomUUID();
  const requests = {
    freeStale: randomUUID(),
    premiumStale: randomUUID(),
    active: randomUUID(),
    settled: randomUUID(),
    otherWorkspaceStale: randomUUID(),
  };
  const email = `ai-recovery-${userId}@local.invalid`;
  const staleAt = new Date(Date.now() - (16 * 60 * 1000)).toISOString();
  const currentAt = new Date().toISOString();
  const premiumPeriodEndsAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

  requireSuccess((await client.from('users').insert({
    id: userId,
    email,
    email_normalized: email,
    display_name: 'AI recovery test user',
    password_hash: 'local-test-password-hash',
  })).error, 'user creation');

  requireSuccess((await client.from('workspaces').insert([
    { id: workspaceId, name: 'AI recovery workspace', owner_id: userId },
    { id: otherWorkspaceId, name: 'Other AI recovery workspace', owner_id: userId },
  ])).error, 'workspace creation');

  requireSuccess((await client.from('meetings').insert([
    {
      id: meetingId,
      workspace_id: workspaceId,
      template_id: 'weekly-family-check-in',
      title: 'AI recovery meeting',
      status: 'completed',
      participant_ids: [],
      sections: [],
      completed_at: currentAt,
    },
    {
      id: otherMeetingId,
      workspace_id: otherWorkspaceId,
      template_id: 'weekly-family-check-in',
      title: 'Other AI recovery meeting',
      status: 'completed',
      participant_ids: [],
      sections: [],
      completed_at: currentAt,
    },
  ])).error, 'meeting creation');

  requireSuccess((await client.from('ai_summary_requests').insert([
    {
      id: requests.freeStale,
      workspace_id: workspaceId,
      user_id: userId,
      meeting_id: meetingId,
      provider: 'openai',
      status: 'pending',
      input_hash: 'free-stale-hash',
      created_at: staleAt,
    },
    {
      id: requests.premiumStale,
      workspace_id: workspaceId,
      user_id: userId,
      meeting_id: meetingId,
      provider: 'openai',
      status: 'pending',
      input_hash: 'premium-stale-hash',
      created_at: staleAt,
    },
    {
      id: requests.active,
      workspace_id: workspaceId,
      user_id: userId,
      meeting_id: meetingId,
      provider: 'openai',
      status: 'pending',
      input_hash: 'active-hash',
      created_at: currentAt,
    },
    {
      id: requests.settled,
      workspace_id: workspaceId,
      user_id: userId,
      meeting_id: meetingId,
      provider: 'openai',
      status: 'completed',
      input_hash: 'settled-hash',
      created_at: staleAt,
      completed_at: staleAt,
      generated_summary: {},
    },
    {
      id: requests.otherWorkspaceStale,
      workspace_id: otherWorkspaceId,
      user_id: userId,
      meeting_id: otherMeetingId,
      provider: 'openai',
      status: 'pending',
      input_hash: 'other-workspace-stale-hash',
      created_at: staleAt,
    },
  ])).error, 'summary request creation');

  requireSuccess((await client.from('assistant_recap_credit_reservations').insert([
    {
      workspace_id: workspaceId,
      ai_summary_request_id: requests.freeStale,
      state: 'reserved',
      reserved_at: staleAt,
      allowance_period_ends_at: null,
    },
    {
      workspace_id: workspaceId,
      ai_summary_request_id: requests.premiumStale,
      state: 'reserved',
      reserved_at: staleAt,
      allowance_period_ends_at: premiumPeriodEndsAt,
    },
    {
      workspace_id: workspaceId,
      ai_summary_request_id: requests.active,
      state: 'reserved',
      reserved_at: currentAt,
      allowance_period_ends_at: null,
    },
    {
      workspace_id: workspaceId,
      ai_summary_request_id: requests.settled,
      state: 'settled',
      reserved_at: staleAt,
      settled_at: staleAt,
      allowance_period_ends_at: null,
    },
    {
      workspace_id: otherWorkspaceId,
      ai_summary_request_id: requests.otherWorkspaceStale,
      state: 'reserved',
      reserved_at: staleAt,
      allowance_period_ends_at: null,
    },
  ])).error, 'credit reservation creation');

  return { userId, workspaceId, otherWorkspaceId, meetingId, requests };
}

describeLocal('AI stale recap recovery RPC', () => {
  let fixture: RecoveryFixture | null = null;

  afterEach(async () => {
    if (!fixture) {
      return;
    }

    const client = createServiceRoleClient(databaseEnvironment!);
    requireSuccess(
      (await client.from('workspaces').delete().in('id', [fixture.workspaceId, fixture.otherWorkspaceId])).error,
      'workspace cleanup',
    );
    requireSuccess(
      (await client.from('users').delete().eq('id', fixture.userId)).error,
      'user cleanup',
    );
    fixture = null;
  });

  it('releases only stale pending work and lets its generation identity be claimed again', async () => {
    const client = createServiceRoleClient(databaseEnvironment!);
    fixture = await createFixture(client);

    requireSuccess(
      (await client.rpc('reconcile_abandoned_assistant_recap_requests', {
        p_workspace_id: fixture.workspaceId,
      })).error,
      'first reconciliation',
    );
    requireSuccess(
      (await client.rpc('reconcile_abandoned_assistant_recap_requests', {
        p_workspace_id: fixture.workspaceId,
      })).error,
      'second reconciliation',
    );

    const { data: requests, error: requestError } = await client
      .from('ai_summary_requests')
      .select('id, status, error_code')
      .in('id', Object.values(fixture.requests));
    requireSuccess(requestError, 'summary request lookup');
    const requestById = new Map(requests?.map((request) => [request.id, request]));

    expect(requestById.get(fixture.requests.freeStale)).toMatchObject({
      status: 'failed',
      error_code: 'ai_summary_request_abandoned',
    });
    expect(requestById.get(fixture.requests.premiumStale)).toMatchObject({
      status: 'failed',
      error_code: 'ai_summary_request_abandoned',
    });
    expect(requestById.get(fixture.requests.active)).toMatchObject({ status: 'pending' });
    expect(requestById.get(fixture.requests.settled)).toMatchObject({ status: 'completed' });
    expect(requestById.get(fixture.requests.otherWorkspaceStale)).toMatchObject({ status: 'pending' });

    const { data: credits, error: creditError } = await client
      .from('assistant_recap_credit_reservations')
      .select('ai_summary_request_id, state')
      .in('ai_summary_request_id', Object.values(fixture.requests));
    requireSuccess(creditError, 'credit lookup');
    const creditByRequestId = new Map(
      credits?.map((credit) => [credit.ai_summary_request_id, credit]),
    );

    expect(creditByRequestId.get(fixture.requests.freeStale)).toMatchObject({ state: 'released' });
    expect(creditByRequestId.get(fixture.requests.premiumStale)).toMatchObject({ state: 'released' });
    expect(creditByRequestId.get(fixture.requests.active)).toMatchObject({ state: 'reserved' });
    expect(creditByRequestId.get(fixture.requests.settled)).toMatchObject({ state: 'settled' });
    expect(creditByRequestId.get(fixture.requests.otherWorkspaceStale)).toMatchObject({ state: 'reserved' });

    const claim = await client.rpc('claim_ai_summary_generation', {
      p_workspace_id: fixture.workspaceId,
      p_meeting_id: fixture.meetingId,
      p_user_id: fixture.userId,
      p_provider: 'openai',
      p_input_hash: 'free-stale-hash',
    }).single();
    requireSuccess(claim.error, 'recovered claim');
    expect(claim.data).toMatchObject({ claim_status: 'created' });
  });
});
