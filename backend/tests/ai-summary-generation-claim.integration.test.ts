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

type ClaimFixture = {
  userId: string;
  workspaceId: string;
  claim: {
    p_workspace_id: string;
    p_meeting_id: string;
    p_user_id: string;
    p_provider: string;
    p_input_hash: string;
  };
  claimV3: {
    p_workspace_id: string;
    p_meeting_id: string;
    p_user_id: string;
    p_provider: string;
    p_input_hash: string;
    p_effective_model: string;
    p_prompt_version: string;
    p_user_limit: number;
    p_workspace_limit: number;
    p_window_seconds: number;
  };
  summary: Record<string, unknown>;
};

function requireSuccess(error: { message: string } | null, operation: string) {
  if (error) {
    throw new Error(`Local AI claim fixture ${operation} failed.`);
  }
}

async function createFixture(client: SupabaseClient): Promise<ClaimFixture> {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const meetingId = randomUUID();
  const email = `ai-claim-${userId}@local.invalid`;

  requireSuccess((await client.from('users').insert({
    id: userId,
    email,
    email_normalized: email,
    display_name: 'AI claim test user',
    password_hash: 'local-test-password-hash',
  })).error, 'user creation');

  requireSuccess((await client.from('workspaces').insert({
    id: workspaceId,
    name: 'AI claim test workspace',
    owner_id: userId,
  })).error, 'workspace creation');

  requireSuccess((await client.from('meetings').insert({
    id: meetingId,
    workspace_id: workspaceId,
    template_id: 'weekly-family-check-in',
    title: 'AI claim test meeting',
    status: 'completed',
    participant_ids: [],
    sections: [],
    completed_at: new Date().toISOString(),
  })).error, 'meeting creation');

  const claim = {
    p_workspace_id: workspaceId,
    p_meeting_id: meetingId,
    p_user_id: userId,
    p_provider: 'openai',
    p_input_hash: `local-claim-${randomUUID()}`,
  };

  return {
    userId,
    workspaceId,
    claim,
    claimV3: {
      ...claim,
      p_input_hash: `local-claim-v3-${randomUUID()}`,
      p_effective_model: 'gpt-5.4-nano',
      p_prompt_version: 'weekly-family-check-in-v1',
      p_user_limit: 5,
      p_workspace_limit: 20,
      p_window_seconds: 60 * 60,
    },
    summary: { source: 'local-ai-claim-integration-test' },
  };
}

describeLocal('AI summary generation claim RPC', () => {
  let fixture: ClaimFixture | null = null;

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

  it('returns one owner, one pending duplicate, then the persisted completed request', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);

    const [first, second] = await Promise.all([
      client.rpc('claim_ai_summary_generation', fixture.claim).single(),
      client.rpc('claim_ai_summary_generation', fixture.claim).single(),
    ]);
    requireSuccess(first.error, 'first claim');
    requireSuccess(second.error, 'second claim');

    expect([first.data?.claim_status, second.data?.claim_status].sort()).toEqual([
      'created',
      'pending',
    ]);

    const owner = [first.data, second.data].find(
      (claim) => claim?.claim_status === 'created',
    );
    expect(owner?.id).toEqual(expect.any(String));

    requireSuccess((await client.from('ai_summary_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      generated_summary: fixture.summary,
    }).eq('id', owner!.id)).error, 'claim completion');

    const cached = await client
      .rpc('claim_ai_summary_generation', fixture.claim)
      .single();
    requireSuccess(cached.error, 'completed claim');
    expect(cached.data).toMatchObject({
      claim_status: 'completed',
      id: owner!.id,
      generated_summary: fixture.summary,
    });
  });

  it('persists model audit fields through v3 pending and completed claims', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);

    const [first, second] = await Promise.all([
      client.rpc('claim_ai_summary_generation_v3', fixture.claimV3).single(),
      client.rpc('claim_ai_summary_generation_v3', fixture.claimV3).single(),
    ]);
    requireSuccess(first.error, 'first v3 claim');
    requireSuccess(second.error, 'second v3 claim');

    expect([first.data?.claim_status, second.data?.claim_status].sort()).toEqual([
      'created',
      'pending',
    ]);
    expect(first.data).toMatchObject({
      effective_model: fixture.claimV3.p_effective_model,
      prompt_version: fixture.claimV3.p_prompt_version,
    });
    expect(second.data).toMatchObject({
      effective_model: fixture.claimV3.p_effective_model,
      prompt_version: fixture.claimV3.p_prompt_version,
    });

    const owner = [first.data, second.data].find(
      (claim) => claim?.claim_status === 'created',
    );
    requireSuccess((await client.from('ai_summary_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      generated_summary: fixture.summary,
    }).eq('id', owner!.id)).error, 'v2 claim completion');

    const cached = await client
      .rpc('claim_ai_summary_generation_v3', fixture.claimV3)
      .single();
    requireSuccess(cached.error, 'completed v3 claim');
    expect(cached.data).toMatchObject({
      claim_status: 'completed',
      id: owner!.id,
      effective_model: fixture.claimV3.p_effective_model,
      prompt_version: fixture.claimV3.p_prompt_version,
      generated_summary: fixture.summary,
    });
  });

  it('enforces the exact user boundary and returns the oldest active slot expiry', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);

    const created = await Promise.all(
      Array.from({ length: 5 }, (_, index) => client
        .rpc('claim_ai_summary_generation_v3', {
          ...fixture!.claimV3,
          p_input_hash: `local-user-boundary-${index}-${randomUUID()}`,
        })
        .single()),
    );
    created.forEach((result) => requireSuccess(result.error, 'user boundary claim'));
    expect(created.map((result) => result.data?.claim_status)).toEqual([
      'created', 'created', 'created', 'created', 'created',
    ]);

    const rejected = await client
      .rpc('claim_ai_summary_generation_v3', {
        ...fixture.claimV3,
        p_input_hash: `local-user-boundary-rejected-${randomUUID()}`,
      })
      .single();
    requireSuccess(rejected.error, 'user boundary rejection');
    expect(rejected.data).toMatchObject({ claim_status: 'rate_limited', rate_limit_scope: 'user' });
    const oldestCreatedAt = Math.min(
      ...created.map((result) => Date.parse(result.data!.created_at)),
    );
    expect(Date.parse(rejected.data!.rate_limit_reset_at)).toBe(
      oldestCreatedAt + 60 * 60 * 1000,
    );
  });

  it('serializes concurrent distinct workspace claims at the exact workspace boundary', async () => {
    const client = createClient(localUrl!, localServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    fixture = await createFixture(client);

    const claims = await Promise.all(
      Array.from({ length: 21 }, (_, index) => client
        .rpc('claim_ai_summary_generation_v3', {
          ...fixture!.claimV3,
          p_input_hash: `local-workspace-boundary-${index}-${randomUUID()}`,
          p_user_limit: 100,
        })
        .single()),
    );
    claims.forEach((result) => requireSuccess(result.error, 'workspace boundary claim'));
    expect(claims.filter((result) => result.data?.claim_status === 'created')).toHaveLength(20);
    expect(claims.filter((result) => result.data?.claim_status === 'rate_limited')).toHaveLength(1);
    expect(claims.find((result) => result.data?.claim_status === 'rate_limited')?.data).toMatchObject({
      rate_limit_scope: 'workspace',
    });
  });
});
