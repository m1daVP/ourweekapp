import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

const localUrl = process.env.SUPABASE_LOCAL_URL;
const localServiceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
const localHost = localUrl ? new URL(localUrl).hostname : null;
const canRunLocally = Boolean(
  localUrl
  && localServiceRoleKey
  && (localHost === '127.0.0.1' || localHost === 'localhost'),
);
const describeLocal = canRunLocally ? describe : describe.skip;

type FinalizationFixture = {
  userId: string;
  workspaceId: string;
  meetingId: string;
  requestId: string;
  summary: Record<string, unknown>;
};

function requireSuccess(error: { message: string } | null, operation: string) {
  if (error) {
    throw new Error(`Local AI finalization fixture ${operation} failed.`);
  }
}

async function createFixture(client: SupabaseClient): Promise<FinalizationFixture> {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const meetingId = randomUUID();
  const requestId = randomUUID();
  const email = `ai-finalization-${userId}@local.invalid`;
  const summary = { source: 'local-ai-finalization-integration-test' };
  const now = new Date().toISOString();

  requireSuccess((await client.from('users').insert({
    id: userId,
    email,
    email_normalized: email,
    display_name: 'AI finalization test user',
    password_hash: 'local-test-password-hash',
  })).error, 'user creation');

  requireSuccess((await client.from('workspaces').insert({
    id: workspaceId,
    name: 'AI finalization workspace',
    owner_id: userId,
  })).error, 'workspace creation');

  requireSuccess((await client.from('meetings').insert({
    id: meetingId,
    workspace_id: workspaceId,
    template_id: 'weekly-family-check-in',
    title: 'AI finalization meeting',
    status: 'completed',
    participant_ids: [],
    sections: [],
    completed_at: now,
  })).error, 'meeting creation');

  requireSuccess((await client.from('ai_summary_requests').insert({
    id: requestId,
    workspace_id: workspaceId,
    user_id: userId,
    meeting_id: meetingId,
    provider: 'openai',
    status: 'pending',
    input_hash: `local-finalization-${randomUUID()}`,
  })).error, 'request creation');

  requireSuccess((await client.from('assistant_recap_credit_reservations').insert({
    workspace_id: workspaceId,
    ai_summary_request_id: requestId,
    state: 'reserved',
    allowance_period_ends_at: null,
  })).error, 'credit creation');

  return { userId, workspaceId, meetingId, requestId, summary };
}

function finalizationInput(fixture: FinalizationFixture) {
  return {
    p_workspace_id: fixture.workspaceId,
    p_request_id: fixture.requestId,
    p_meeting_id: fixture.meetingId,
    p_expected_server_revision: 1,
    p_generated_summary: fixture.summary,
    p_completed_at: '2026-09-04T12:00:00.000Z',
    p_input_tokens: 320,
    p_output_tokens: 90,
    p_total_tokens: 410,
  };
}

describeLocal('AI summary generation finalization RPC', () => {
  let fixture: FinalizationFixture | null = null;

  afterEach(async () => {
    if (!fixture) {
      return;
    }

    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    requireSuccess(
      (await client.from('workspaces').delete().eq('id', fixture.workspaceId)).error,
      'workspace cleanup',
    );
    requireSuccess(
      (await client.from('users').delete().eq('id', fixture.userId)).error,
      'user cleanup',
    );
    fixture = null;
  });

  it('applies finalization once and returns its completed result on a retry', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);

    const first = await client
      .rpc('finalize_ai_summary_generation', finalizationInput(fixture))
      .single();
    requireSuccess(first.error, 'first finalization');
    expect(first.data).toMatchObject({
      finalization_status: 'applied',
      meeting_id: fixture.meetingId,
      source_server_revision: 1,
      server_revision: 2,
    });

    const second = await client
      .rpc('finalize_ai_summary_generation', finalizationInput(fixture))
      .single();
    requireSuccess(second.error, 'idempotent finalization');
    expect(second.data).toMatchObject({
      finalization_status: 'completed',
      meeting_id: fixture.meetingId,
      source_server_revision: 1,
      server_revision: 2,
    });

    const { data: meeting, error: meetingError } = await client
      .from('meetings')
      .select('ai_summary, server_revision')
      .eq('id', fixture.meetingId)
      .single();
    requireSuccess(meetingError, 'meeting lookup');
    expect(meeting).toMatchObject({ ai_summary: fixture.summary, server_revision: 2 });

    const { data: request, error: requestError } = await client
      .from('ai_summary_requests')
      .select('status, generated_summary, input_tokens, output_tokens, total_tokens')
      .eq('id', fixture.requestId)
      .single();
    requireSuccess(requestError, 'request lookup');
    expect(request).toMatchObject({
      status: 'completed',
      generated_summary: fixture.summary,
      input_tokens: 320,
      output_tokens: 90,
      total_tokens: 410,
    });

    const { data: credit, error: creditError } = await client
      .from('assistant_recap_credit_reservations')
      .select('state')
      .eq('ai_summary_request_id', fixture.requestId)
      .single();
    requireSuccess(creditError, 'credit lookup');
    expect(credit).toMatchObject({ state: 'settled' });
  });

  it('leaves the request and credit pending when the meeting revision changed', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);
    requireSuccess((await client.from('meetings').update({ server_revision: 2 })
      .eq('id', fixture.meetingId)).error, 'meeting revision change');

    const result = await client
      .rpc('finalize_ai_summary_generation', finalizationInput(fixture))
      .single();
    requireSuccess(result.error, 'revision conflict finalization');
    expect(result.data).toMatchObject({
      finalization_status: 'revision_conflict',
      meeting_id: fixture.meetingId,
      source_server_revision: 1,
      server_revision: null,
      updated_at: null,
    });

    const { data: request, error: requestError } = await client
      .from('ai_summary_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .single();
    requireSuccess(requestError, 'request lookup');
    expect(request).toMatchObject({ status: 'pending' });

    const { data: credit, error: creditError } = await client
      .from('assistant_recap_credit_reservations')
      .select('state')
      .eq('ai_summary_request_id', fixture.requestId)
      .single();
    requireSuccess(creditError, 'credit lookup');
    expect(credit).toMatchObject({ state: 'reserved' });
  });
});
