# AI Concurrent Generation Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make identical concurrent AI meeting-summary requests result in exactly one provider call and one settled recap credit.

**Architecture:** Add an additive migration that persists each completed request's validated summary snapshot and introduces a service-role claim RPC. The RPC serializes claim decisions on `(workspace_id, meeting_id, input_hash)` and reports whether the caller owns generation, must retry while another request is pending, or can return stored output. The service consumes that outcome without changing its successful response contract.

**Tech Stack:** Node.js 24, TypeScript 7, Fastify 5, Vitest 4, Supabase/PostgreSQL 17, Zod 4.

## Global Constraints

- Preserve existing workspace authorization, adult-member checks, meeting revision protections, and private-data prompt filtering.
- Keep `input_hash` derived from system prompt, sanitized prompt payload, and effective model.
- Do not perform provider calls, production database mutations, deployment, staging, or commits without separate explicit authorization.
- Use an additive migration; deploy it before backend code that calls the new RPC.
- Keep AI-06 stale-pending recovery and AI-07 atomic finalization out of scope.
- Do not expose stored summary snapshots through direct table access, logs, error details, or unauthenticated APIs.
- All migration integration checks must use an isolated local database, never production credentials.

---

## File structure

- `supabase/migrations/20260904120000_add_ai_summary_generation_claim.sql`: additive request snapshot column, active-claim uniqueness invariant, and service-role-only atomic claim RPC.
- `src/modules/ai/ai.repository.ts`: maps the internal snapshot and RPC claim response; stores a snapshot when marking a request completed.
- `src/modules/ai/ai.service.ts`: replaces the check-then-insert cache path with one claim decision and maps a pending duplicate to a safe 409.
- `tests/ai-summary-generation-claim.migration.test.ts`: locks down migration security, identity, lock, and partial-index requirements.
- `tests/ai.repository.test.ts`: verifies repository RPC parameter mapping, claim-response mapping, completion snapshot write, and database errors.
- `tests/ai.service.test.ts`: covers owner, pending duplicate, completed snapshot cache, failed retry, and identity isolation behavior.
- `tests/ai-summary-generation-claim.integration.test.ts`: opt-in, local-only RPC concurrency verification using `SUPABASE_LOCAL_URL` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY`.

### Task 1: Define the migration contract and atomic database claim

**Files:**

- Create: `supabase/migrations/20260904120000_add_ai_summary_generation_claim.sql`
- Create: `tests/ai-summary-generation-claim.migration.test.ts`

**Interfaces:**

- Produces: `public.claim_ai_summary_generation(p_workspace_id uuid, p_meeting_id uuid, p_user_id uuid, p_provider text, p_input_hash text)`, returning `claim_status text`, request metadata, and `generated_summary jsonb`.
- Produces: nullable `public.ai_summary_requests.generated_summary jsonb`.
- Consumes: existing `ai_summary_requests` columns and service-role database access.

- [ ] **Step 1: Write failing migration-contract tests**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20260904120000_add_ai_summary_generation_claim.sql'),
  'utf8',
);

describe('AI summary generation claim migration', () => {
  it('persists cache output and permits only one pending generation identity', () => {
    expect(sql).toContain('add column if not exists generated_summary jsonb');
    expect(sql).toContain('ai_summary_requests_active_generation_unique_idx');
    expect(sql).toContain('workspace_id, meeting_id, input_hash');
    expect(sql).toContain("where status = 'pending' and input_hash is not null");
  });

  it('serializes the claim and limits execution to the service role', () => {
    expect(sql).toContain('public.claim_ai_summary_generation');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
```

- [ ] **Step 2: Run the migration-contract test to verify it fails**

Run: `npm test -- tests/ai-summary-generation-claim.migration.test.ts`

Expected: FAIL because the migration file does not yet exist.

- [ ] **Step 3: Add the additive migration**

```sql
alter table public.ai_summary_requests
  add column if not exists generated_summary jsonb;

create unique index ai_summary_requests_active_generation_unique_idx
  on public.ai_summary_requests (workspace_id, meeting_id, input_hash)
  where status = 'pending' and input_hash is not null;

create or replace function public.claim_ai_summary_generation(
  p_workspace_id uuid,
  p_meeting_id uuid,
  p_user_id uuid,
  p_provider text,
  p_input_hash text
)
returns table (
  claim_status text,
  id uuid,
  workspace_id uuid,
  user_id uuid,
  meeting_id uuid,
  provider text,
  status text,
  input_hash text,
  created_at timestamptz,
  completed_at timestamptz,
  error_code text,
  generated_summary jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_summary_requests%rowtype;
begin
  if p_workspace_id is null or p_meeting_id is null or p_user_id is null
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_input_hash), '') is null then
    raise exception using errcode = '22023', message = 'invalid AI summary claim input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_workspace_id::text || ':' || p_meeting_id::text || ':' || p_input_hash,
    0
  ));

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'completed'
    and generated_summary is not null
  order by created_at desc, id desc
  limit 1;

  if found then
    return query select 'completed', v_request.id, v_request.workspace_id,
      v_request.user_id, v_request.meeting_id, v_request.provider,
      v_request.status, v_request.input_hash, v_request.created_at,
      v_request.completed_at, v_request.error_code, v_request.generated_summary;
    return;
  end if;

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'pending'
  order by created_at asc, id asc
  limit 1;

  if found then
    return query select 'pending', v_request.id, v_request.workspace_id,
      v_request.user_id, v_request.meeting_id, v_request.provider,
      v_request.status, v_request.input_hash, v_request.created_at,
      v_request.completed_at, v_request.error_code, v_request.generated_summary;
    return;
  end if;

  insert into public.ai_summary_requests (
    workspace_id, user_id, meeting_id, provider, status, input_hash
  ) values (
    p_workspace_id, p_user_id, p_meeting_id, p_provider, 'pending', p_input_hash
  ) returning * into v_request;

  return query select 'created', v_request.id, v_request.workspace_id,
    v_request.user_id, v_request.meeting_id, v_request.provider,
    v_request.status, v_request.input_hash, v_request.created_at,
    v_request.completed_at, v_request.error_code, v_request.generated_summary;
end;
$$;

revoke all on function public.claim_ai_summary_generation(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_ai_summary_generation(uuid, uuid, uuid, text, text)
  to service_role;
```

Do not add an RLS policy: the table already follows the project's deny-all RLS model and the RPC is service-role-only. Do not alter existing recap-reservation functions.

- [ ] **Step 4: Run the migration-contract test to verify it passes**

Run: `npm test -- tests/ai-summary-generation-claim.migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only after explicit approval**

Do not stage or commit automatically. If the user supplies an approved numbered commit list, use the project’s commit-approved workflow and include only this migration test and migration in the approved group.

### Task 2: Make repository claim and snapshot persistence typed

**Files:**

- Modify: `src/modules/ai/ai.repository.ts:6-197`
- Create: `tests/ai.repository.test.ts`

**Interfaces:**

- Consumes: `claim_ai_summary_generation` RPC from Task 1.
- Produces: `AiSummaryGenerationClaim` union with `status: 'created' | 'pending' | 'completed'` and `request: AiSummaryRequestRecord`.
- Produces: `claimSummaryGeneration(input: ClaimAiSummaryGenerationInput): Promise<AiSummaryGenerationClaim>`.
- Changes: `markSummaryRequestCompleted(workspaceId, requestId, completedAt, summary, usage?)` persists the snapshot.

- [ ] **Step 1: Write failing repository tests**

```ts
it('claims an AI summary generation through the workspace-scoped RPC', async () => {
  const rpc = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: claimRow('created'), error: null }),
  });
  const repository = new AiRepository({ rpc } as never);

  await expect(repository.claimSummaryGeneration({
    workspaceId, meetingId, userId, provider: 'openai', inputHash: 'hash_1',
  })).resolves.toMatchObject({ status: 'created', request: { id: 'request_1' } });

  expect(rpc).toHaveBeenCalledWith('claim_ai_summary_generation', {
    p_workspace_id: workspaceId,
    p_meeting_id: meetingId,
    p_user_id: userId,
    p_provider: 'openai',
    p_input_hash: 'hash_1',
  });
});

it('writes the validated summary snapshot when completing a request', async () => {
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: requestRow(), error: null }) }),
    }) }),
  });
  const repository = new AiRepository({ from: vi.fn().mockReturnValue({ update }) } as never);

  await repository.markSummaryRequestCompleted(workspaceId, 'request_1', now, summary, null);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ generated_summary: summary }));
});
```

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `npm test -- tests/ai.repository.test.ts`

Expected: FAIL because `claimSummaryGeneration` and the summary completion parameter do not exist.

- [ ] **Step 3: Add repository types and implementation**

```ts
export type ClaimAiSummaryGenerationInput = {
  workspaceId: string;
  meetingId: string;
  userId: string;
  provider: string;
  inputHash: string;
};

export type AiSummaryGenerationClaim = {
  status: 'created' | 'pending' | 'completed';
  request: AiSummaryRequestRecord;
};

async claimSummaryGeneration(input: ClaimAiSummaryGenerationInput) {
  const { data, error } = await this.supabase
    .rpc('claim_ai_summary_generation', {
      p_workspace_id: input.workspaceId,
      p_meeting_id: input.meetingId,
      p_user_id: input.userId,
      p_provider: input.provider,
      p_input_hash: input.inputHash,
    })
    .single<AiSummaryGenerationClaimRow>();

  const row = requireRow(data, error, 'ai_summary_request_claim_failed', 'Unable to claim AI summary generation.');
  if (!['created', 'pending', 'completed'].includes(row.claim_status)) {
    throw new ApiError(500, 'ai_summary_request_claim_invalid', 'Unable to claim AI summary generation.');
  }
  return { status: row.claim_status, request: mapAiSummaryRequestRowToRecord(row) };
}
```

Import and use the project's existing safe error pattern rather than returning a raw RPC error. Extend the selected row and row type with `generated_summary`; do not add it to public DTOs. Make `markSummaryRequestCompleted` accept the JSON-safe validated summary and set `generated_summary` in the same update that changes request status.

- [ ] **Step 4: Run the repository tests to verify they pass**

Run: `npm test -- tests/ai.repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only after explicit approval**

Do not stage or commit automatically. An approved commit group for this task includes only `src/modules/ai/ai.repository.ts` and `tests/ai.repository.test.ts`.

### Task 3: Use the claim outcome in summary generation

**Files:**

- Modify: `src/modules/ai/ai.service.ts:26-354`
- Modify: `tests/ai.service.test.ts:104-765`

**Interfaces:**

- Consumes: `AiRepository.claimSummaryGeneration` from Task 2.
- Produces: `409 ai_summary_generation_in_progress` for `pending` claims, with `{ requestId }` safe details.
- Produces: unchanged `AiMeetingSummaryResponseDto` for `completed` snapshots and created generation.

- [ ] **Step 1: Write failing service tests for each claim outcome**

```ts
it('returns a retryable conflict without provider or credit work when another matching request is pending', async () => {
  const { ai, provider, service } = createHarness({
    claim: { status: 'pending', request: request({ id: 'request_owner' }) },
  });

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).rejects.toMatchObject({
    statusCode: 409,
    code: 'ai_summary_generation_in_progress',
    details: { requestId: 'request_owner' },
  });
  expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  expect(ai.markSummaryRequestFailed).not.toHaveBeenCalled();
});

it('returns the claimed completed request snapshot, not the current meeting summary', async () => {
  const { provider, service } = createHarness({
    meeting: meeting({ aiSummary: differentValidSummary }),
    claim: { status: 'completed', request: request({ generatedSummary: cachedSummary }) },
  });

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).resolves.toMatchObject({
    summary: cachedSummary,
  });
  expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
});

it('only sends one provider request when two identical calls overlap', async () => {
  const providerDeferred = deferred<ProviderResult>();
  const { ai, provider, service } = createHarness({
    claimSequence: [createdClaim, pendingClaim], providerDeferred,
  });

  const owner = service.generateMeetingSummary(auth, { meetingId }, new Date(now));
  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).rejects.toMatchObject({
    code: 'ai_summary_generation_in_progress',
  });
  expect(provider.generateMeetingSummary).toHaveBeenCalledTimes(1);
  providerDeferred.resolve({ output: providerOutput(), usage: null });
  await owner;
  expect(ai.markSummaryRequestCompleted).toHaveBeenCalledTimes(1);
});
```

Also add a failed-claim retry test (`failed` is ignored by the claim RPC, so the next result is `created`), and two isolation tests where a changed prompt input or a different workspace returns `created` independently.

- [ ] **Step 2: Run the focused service tests to verify they fail**

Run: `npm test -- tests/ai.service.test.ts`

Expected: FAIL because the service still calls `findCompletedSummaryRequestByInputHash` and `createSummaryRequest` separately.

- [ ] **Step 3: Replace the split lookup/insert path with a claim**

```ts
const claim = await this.aiRepository.claimSummaryGeneration({
  workspaceId: auth.workspaceId,
  meetingId: meeting.id,
  userId: auth.userId,
  provider: providerName,
  inputHash,
});

if (claim.status === 'pending') {
  throw new ApiError(409, 'ai_summary_generation_in_progress',
    'An identical AI summary is already being generated. Please try again shortly.',
    { requestId: claim.request.id });
}

if (claim.status === 'completed') {
  const parsedSummary = meetingSummarySchema.safeParse(claim.request.generatedSummary);
  if (!parsedSummary.success) {
    throw new ApiError(500, 'ai_summary_request_cache_invalid', 'Unable to load AI summary.');
  }
  return cachedSummaryResponse(parsedSummary.data, meeting);
}

const summaryRequest = claim.request;
```

Update the AI repository port to remove `createSummaryRequest` and
`findCompletedSummaryRequestByInputHash`, and include `claimSummaryGeneration`.
Pass the fully validated `summary` to `markSummaryRequestCompleted` so its
snapshot is persisted. Preserve existing created-owner failure handling, but do
not run it for `pending` or `completed` claims.

Keep the existing authorization, revision, completion, input-size, and initial
rate-limit checks before the claim. Keep allowance reservation and the second
rate-limit check only in the `created` branch. Add safe structured logs for
`pending` and `completed` outcomes with request ID, workspace ID, meeting ID,
provider, model, and duration only.

- [ ] **Step 4: Run focused service tests to verify they pass**

Run: `npm test -- tests/ai.service.test.ts`

Expected: PASS, including the overlap test and all existing service behavior.

- [ ] **Step 5: Commit only after explicit approval**

Do not stage or commit automatically. An approved commit group for this task includes only `src/modules/ai/ai.service.ts` and `tests/ai.service.test.ts`.

### Task 4: Verify the database invariant against an isolated local Supabase instance

**Files:**

- Create: `tests/ai-summary-generation-claim.integration.test.ts`
- Modify: `AI_RELEASE_CHECKLIST.md` only if the local integration test actually runs and its result is verified.

**Interfaces:**

- Consumes: the migration RPC and `SUPABASE_LOCAL_URL` / `SUPABASE_LOCAL_SERVICE_ROLE_KEY` supplied only for local test execution.
- Produces: an opt-in integration suite that proves two concurrent RPC claims yield one `created` and one `pending`, and a later call yields `completed` after a summary snapshot is recorded.

- [ ] **Step 1: Write the opt-in local integration test**

```ts
const localUrl = process.env.SUPABASE_LOCAL_URL;
const localServiceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
const describeLocal = localUrl && localServiceRoleKey ? describe : describe.skip;

describeLocal('AI summary generation claim RPC', () => {
  it('returns one owner, one pending duplicate, then the stored completed result', async () => {
    const client = createServiceRoleSupabaseClient(localUrl!, localServiceRoleKey!);
    const fixture = await createClaimFixture(client);

    const [first, second] = await Promise.all([
      client.rpc('claim_ai_summary_generation', fixture.claim).single(),
      client.rpc('claim_ai_summary_generation', fixture.claim).single(),
    ]);
    expect([first.data?.claim_status, second.data?.claim_status].sort()).toEqual(['created', 'pending']);

    const ownerId = [first.data, second.data].find((row) => row?.claim_status === 'created')!.id;
    await client.from('ai_summary_requests').update({
      status: 'completed', completed_at: new Date().toISOString(), generated_summary: fixture.summary,
    }).eq('id', ownerId);

    const cached = await client.rpc('claim_ai_summary_generation', fixture.claim).single();
    expect(cached.data).toMatchObject({ claim_status: 'completed', id: ownerId, generated_summary: fixture.summary });
  });
});
```

`createClaimFixture` must insert unique local-only user, workspace, and completed meeting records, then delete the workspace in `afterEach` so cascading deletes remove all requests. Use `crypto.randomUUID()` for every fixture ID. The test must not load `.env`, accept remote URLs, or print service keys or summary content.

- [ ] **Step 2: Run the test without local credentials to verify safe skipping**

Run: `npm test -- tests/ai-summary-generation-claim.integration.test.ts`

Expected: PASS with the integration suite skipped when both local-only variables are absent.

- [ ] **Step 3: Apply and verify against an isolated local database when available**

Run: `npm run db:migrate:local`

Then run with values obtained from the locally started Supabase stack only:

Run: `$env:SUPABASE_LOCAL_URL='http://127.0.0.1:54321'; $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY='<local-service-role-key>'; npm test -- tests/ai-summary-generation-claim.integration.test.ts`

Expected: PASS with one `created`, one `pending`, and one `completed` claim. Do not run either command against staging or production. If no isolated local stack is available, record this as unrun rather than substituting a remote database.

- [ ] **Step 4: Run the complete backend verification set**

Run: `npm run typecheck`

Run: `npm test -- tests/ai-summary-generation-claim.migration.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts tests/ai-summary-generation-claim.integration.test.ts tests/ai.routes.test.ts`

Run: `npm test`

Run: `npm run build`

Run: `npm run openapi:check`

Expected: all applicable checks pass. If any pre-existing failure occurs, capture the exact command and failure separately; do not suppress, reformat unrelated code, or disable tests.

- [ ] **Step 5: Record verified evidence and commit only after explicit approval**

If and only if Task 4's local integration run completes, update the AI-05 checklist entry with the exact command and result. Do not claim local-database verification if the suite was skipped. Do not stage or commit automatically; an approved group may include only the integration test and its verified checklist update.

## Plan self-review

Spec coverage: Task 1 establishes atomic, workspace/meeting/input-scoped claiming; Task 2 persists and reads a request-bound cache snapshot; Task 3 defines created/pending/completed and retry semantics with service tests; Task 4 verifies actual concurrent RPC behavior only on an isolated local database. API compatibility, safe logging, migration ordering, and the AI-06/AI-07 boundaries are stated in global constraints and implementation steps.

Placeholder scan: no placeholder markers or unspecified implementation steps remain. The local test's credentials are intentionally external local-only configuration and must not be committed.

Type consistency: `ClaimAiSummaryGenerationInput`, `AiSummaryGenerationClaim`, `claimSummaryGeneration`, `generatedSummary`, and the `created` / `pending` / `completed` statuses are used consistently across repository and service tasks.
