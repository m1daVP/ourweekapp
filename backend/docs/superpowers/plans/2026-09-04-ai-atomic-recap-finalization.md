# AI Atomic Recap Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomically save a generated meeting summary, complete its request audit row, and settle its reserved recap credit without allowing partial-success accounting states.

**Architecture:** Add a service-role-only PostgreSQL RPC that holds the workspace credit lock, validates the pending request/reservation and source meeting revision, then performs all success writes in one transaction. `AiRepository` exposes a typed wrapper for the RPC, and `AiSummaryService` replaces three separate writes with that wrapper while treating uncertain finalization failures as recoverable pending work.

**Tech Stack:** Node.js 24, TypeScript 7, Fastify, Supabase/PostgreSQL, Vitest 4.

## Global Constraints

- Keep the OpenAI/provider request outside every database transaction.
- Preserve AI-02 optimistic meeting-revision protection: a changed or deleted meeting returns `409 meeting_update_conflict` and never receives output generated from the earlier input.
- Preserve AI-05 claim/cache identity and AI-06 stale pending-request recovery; do not broaden this work into provider diagnostics, rate limits, prompts, or allowance policy changes.
- Scope every workspace-owned query and RPC update by `workspace_id`; run the new function as `security definer` with `set search_path = ''`, revoke public execution, and grant only `service_role`.
- Use a new additive migration; do not edit applied migrations.
- Never log prompts, generated meeting content, provider responses, secrets, tokens, or headers. Cleanup logs may contain only safe IDs and error codes.
- Use `apply_patch` for all edits. Do not stage, commit, push, deploy, spend provider funds, or apply a database migration outside an isolated local test database without separate explicit authorization.
- Keep the existing public successful DTO and safe error DTO shape stable.

---

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260904150000_add_ai_summary_generation_finalization.sql` | Defines the locked, service-role-only, atomic finalization RPC. |
| `src/modules/ai/ai.repository.ts` | Maps the RPC request/result contract into typed backend values and safe repository errors. |
| `src/modules/ai/ai.service.ts` | Calls the finalizer after provider success; preserves primary errors while isolating cleanup failures. |
| `tests/ai-summary-generation-finalization.migration.test.ts` | Regression checks the migration’s transactional, authorization, and state-validation contract. |
| `tests/ai.repository.test.ts` | Verifies typed finalization RPC argument/result mapping and invalid-result handling. |
| `tests/ai.service.test.ts` | Verifies success, conflict, uncertain finalization, and cleanup behavior at the service boundary. |
| `AI_RELEASE_CHECKLIST.md` | Records implementation evidence only after all listed checks have actually run. |

### Task 1: Define and test the database-owned finalization contract

**Files:**
- Create: `tests/ai-summary-generation-finalization.migration.test.ts`
- Create: `supabase/migrations/20260904150000_add_ai_summary_generation_finalization.sql`

**Interfaces:**
- Consumes: `public.ai_summary_requests`, `public.assistant_recap_credit_reservations`, and `public.meetings` as created by existing migrations; `generated_summary`, token-usage columns, and the AI-06 workspace advisory-lock convention.
- Produces: `public.finalize_ai_summary_generation(p_workspace_id uuid, p_request_id uuid, p_meeting_id uuid, p_expected_server_revision integer, p_generated_summary jsonb, p_completed_at timestamptz, p_input_tokens integer, p_output_tokens integer, p_total_tokens integer)` returning one row with `finalization_status text`, `meeting_id uuid`, `source_server_revision integer`, `server_revision integer`, and `updated_at timestamptz`.

- [ ] **Step 1: Write the failing migration-contract tests**

Create `tests/ai-summary-generation-finalization.migration.test.ts` with concrete assertions that the new migration file defines the RPC and its safety properties:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260904150000_add_ai_summary_generation_finalization.sql',
);

describe('AI summary generation finalization migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('atomically writes the meeting, completed request, and settled credit', () => {
    expect(sql).toContain('public.finalize_ai_summary_generation');
    expect(sql).toContain("update public.meetings");
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain("state = 'settled'");
    expect(sql).toContain('generated_summary = p_generated_summary');
    expect(sql).toContain('input_tokens = p_input_tokens');
    expect(sql).toContain('output_tokens = p_output_tokens');
    expect(sql).toContain('total_tokens = p_total_tokens');
  });

  it('uses a workspace lock, source revision, and service-role-only access', () => {
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))');
    expect(sql).toContain('and server_revision = p_expected_server_revision');
    expect(sql).toContain("deleted_at is null");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });

  it('keeps repeated and failed finalization attempts safe', () => {
    expect(sql).toContain("v_request.status = 'completed'");
    expect(sql).toContain("v_request.status <> 'pending'");
    expect(sql).toContain("v_credit.state <> 'reserved'");
    expect(sql).toContain("'revision_conflict'");
    expect(sql).not.toContain('commit;');
    expect(sql).not.toContain('rollback;');
  });
});
```

- [ ] **Step 2: Run the migration-contract test to verify it fails**

Run:

```powershell
npm test -- tests/ai-summary-generation-finalization.migration.test.ts
```

Expected: FAIL because `20260904150000_add_ai_summary_generation_finalization.sql` does not exist.

- [ ] **Step 3: Add the atomic finalization migration**

Create the migration with this RPC shape. Use the aliases/variables below so each row is locked and remains workspace-scoped:

```sql
create or replace function public.finalize_ai_summary_generation(
  p_workspace_id uuid,
  p_request_id uuid,
  p_meeting_id uuid,
  p_expected_server_revision integer,
  p_generated_summary jsonb,
  p_completed_at timestamptz,
  p_input_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer
)
returns table (
  finalization_status text,
  meeting_id uuid,
  source_server_revision integer,
  server_revision integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_summary_requests%rowtype;
  v_credit public.assistant_recap_credit_reservations%rowtype;
  v_meeting public.meetings%rowtype;
begin
  if p_workspace_id is null
    or p_request_id is null
    or p_meeting_id is null
    or p_expected_server_revision is null
    or p_expected_server_revision < 1
    or p_generated_summary is null
    or p_completed_at is null then
    raise exception using errcode = '22023', message = 'invalid AI summary finalization input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  select * into v_request
  from public.ai_summary_requests
  where id = p_request_id and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AI summary request not found';
  end if;

  if v_request.meeting_id <> p_meeting_id then
    raise exception using errcode = '22023', message = 'AI summary request meeting mismatch';
  end if;

  if v_request.status = 'completed' then
    if v_request.generated_summary is distinct from p_generated_summary then
      raise exception using errcode = '22023', message = 'AI summary finalization payload mismatch';
    end if;

    select * into v_meeting
    from public.meetings
    where id = p_meeting_id and workspace_id = p_workspace_id and deleted_at is null;

    if not found then
      raise exception using errcode = 'P0002', message = 'finalized meeting not found';
    end if;

    return query select 'completed', p_meeting_id, p_expected_server_revision,
      v_meeting.server_revision, v_meeting.updated_at;
    return;
  end if;

  if v_request.status <> 'pending' then
    raise exception using errcode = '22023', message = 'AI summary request is not pending';
  end if;

  select * into v_credit
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id and ai_summary_request_id = p_request_id
  for update;

  if not found or v_credit.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'AI summary request has no reserved recap credit';
  end if;

  update public.meetings
  set ai_summary = p_generated_summary,
      server_revision = p_expected_server_revision + 1
  where id = p_meeting_id
    and workspace_id = p_workspace_id
    and server_revision = p_expected_server_revision
    and deleted_at is null
  returning * into v_meeting;

  if not found then
    return query select 'revision_conflict', p_meeting_id,
      p_expected_server_revision, null::integer, null::timestamptz;
    return;
  end if;

  update public.ai_summary_requests
  set status = 'completed', completed_at = p_completed_at, error_code = null,
      input_tokens = p_input_tokens, output_tokens = p_output_tokens,
      total_tokens = p_total_tokens, generated_summary = p_generated_summary
  where id = p_request_id and workspace_id = p_workspace_id;

  update public.assistant_recap_credit_reservations
  set state = 'settled', settled_at = clock_timestamp()
  where id = v_credit.id and workspace_id = p_workspace_id and state = 'reserved';

  return query select 'applied', p_meeting_id, p_expected_server_revision,
    v_meeting.server_revision, v_meeting.updated_at;
end;
$$;
```

Finish the file with exact-signature `revoke all` and `grant execute` statements. Before finalizing the SQL, inspect the existing table definition for the exact settled-timestamp column name; if it is not `settled_at`, use its actual name in the `update` statement and update the test only where the verified schema differs. Do not add manual `COMMIT` or `ROLLBACK`: a PostgreSQL function invoked by the RPC runs inside the caller transaction and errors roll back the entire function call.

- [ ] **Step 4: Run the migration-contract test to verify it passes**

Run:

```powershell
npm test -- tests/ai-summary-generation-finalization.migration.test.ts
```

Expected: PASS. The test proves source review properties; it does not replace an isolated local-Supabase execution test.

- [ ] **Step 5: Review checkpoint**

Review the migration’s table/column names against the existing schema and confirm all `ai_summary_requests`, `assistant_recap_credit_reservations`, and `meetings` lookups include `workspace_id`. Do not stage or commit; commits require a separately approved commit list.

### Task 2: Add a typed finalization repository boundary

**Files:**
- Modify: `src/modules/ai/ai.repository.ts`
- Modify: `tests/ai.repository.test.ts`

**Interfaces:**
- Consumes: `finalize_ai_summary_generation` from Task 1 and `AiSummaryTokenUsage` from `src/modules/ai/openai.client.ts`.
- Produces: `FinalizeAiSummaryGenerationInput`, `AiSummaryGenerationFinalization`, and `AiRepository.finalizeSummaryGeneration(input)` for Task 3.

- [ ] **Step 1: Write failing repository tests**

Add a success fixture and tests that exercise the complete RPC contract:

```ts
const finalizationRow = {
  finalization_status: 'applied',
  meeting_id: meetingId,
  source_server_revision: 1,
  server_revision: 2,
  updated_at: '2026-06-06T10:01:00.000Z',
};

it('finalizes a claimed summary through the workspace-scoped RPC', async () => {
  const single = vi.fn().mockResolvedValue({ data: finalizationRow, error: null });
  const rpc = vi.fn().mockReturnValue({ single });
  const repository = new AiRepository({ rpc } as never);

  await expect(repository.finalizeSummaryGeneration({
    workspaceId,
    requestId: '44444444-4444-4444-8444-444444444444',
    meetingId,
    expectedServerRevision: 1,
    generatedSummary: summary,
    completedAt: '2026-06-06T10:01:00.000Z',
    usage: { inputTokens: 320, outputTokens: 90, totalTokens: 410 },
  })).resolves.toEqual({
    status: 'applied',
    meetingId,
    sourceServerRevision: 1,
    serverRevision: 2,
    updatedAt: '2026-06-06T10:01:00.000Z',
  });

  expect(rpc).toHaveBeenCalledWith('finalize_ai_summary_generation', {
    p_workspace_id: workspaceId,
    p_request_id: '44444444-4444-4444-8444-444444444444',
    p_meeting_id: meetingId,
    p_expected_server_revision: 1,
    p_generated_summary: summary,
    p_completed_at: '2026-06-06T10:01:00.000Z',
    p_input_tokens: 320,
    p_output_tokens: 90,
    p_total_tokens: 410,
  });
});

it('rejects an unknown finalization state without exposing database details', async () => {
  const repository = new AiRepository({
    rpc: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { ...finalizationRow, finalization_status: 'unknown' }, error: null,
      }),
    }),
  } as never);

  await expect(repository.finalizeSummaryGeneration({
    workspaceId, requestId: '44444444-4444-4444-8444-444444444444',
    meetingId, expectedServerRevision: 1, generatedSummary: summary,
    completedAt: '2026-06-06T10:01:00.000Z', usage: null,
  })).rejects.toMatchObject({
    statusCode: 500,
    code: 'ai_summary_request_finalization_invalid',
  });
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run:

```powershell
npm test -- tests/ai.repository.test.ts
```

Expected: FAIL because `finalizeSummaryGeneration` is not defined.

- [ ] **Step 3: Implement the typed RPC wrapper**

In `src/modules/ai/ai.repository.ts`, add types and a method matching the test:

```ts
export type FinalizeAiSummaryGenerationInput = {
  workspaceId: string;
  requestId: string;
  meetingId: string;
  expectedServerRevision: number;
  generatedSummary: JsonValue;
  completedAt: string;
  usage: AiSummaryTokenUsage | null;
};

export type AiSummaryGenerationFinalization = {
  status: 'applied' | 'completed' | 'revision_conflict';
  meetingId: string;
  sourceServerRevision: number;
  serverRevision: number | null;
  updatedAt: string | null;
};
```

Call `.rpc('finalize_ai_summary_generation', ...)` with all nine function parameters, use `.single<FinalizeAiSummaryGenerationRow>()`, and call `requireRow` with code `ai_summary_request_finalization_failed` and message `Unable to finalize AI summary generation.`. Validate that `finalization_status` is exactly `applied`, `completed`, or `revision_conflict`; throw `ApiError(500, 'ai_summary_request_finalization_invalid', 'Unable to finalize AI summary generation.')` for any other state. Convert snake_case keys to the declared camelCase result and use `formatApiDateTime` / `formatNullableApiDateTime` for returned timestamps.

Keep `markSummaryRequestFailed` because Task 3 still uses it for pre-finalization failures and explicit revision-conflict cleanup. Remove `markSummaryRequestCompleted` only after `rg` confirms no production call sites remain; update its existing unit test accordingly instead of leaving dead behavior.

- [ ] **Step 4: Run repository tests to verify they pass**

Run:

```powershell
npm test -- tests/ai.repository.test.ts
```

Expected: PASS, including existing claim coverage and the new finalization mapping/error cases.

- [ ] **Step 5: Review checkpoint**

Confirm the repository does not use a direct `.from('meetings')` or credit-table write and that only the database RPC controls finalization. Do not stage or commit.

### Task 3: Route provider-success persistence through the atomic finalizer

**Files:**
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `tests/ai.service.test.ts`

**Interfaces:**
- Consumes: `AiRepository.finalizeSummaryGeneration(input): Promise<AiSummaryGenerationFinalization>` from Task 2; `AssistantRepository.releaseRecap` and `AiRepository.markSummaryRequestFailed` only for confirmed pre-finalization/revision-conflict cleanup.
- Produces: Existing `AiMeetingSummaryResponseDto` with `meetingSync` supplied by the atomic finalization result.

- [ ] **Step 1: Write failing service tests for the new success and fault boundaries**

Update the test harness so `ai` supplies a default finalization result:

```ts
finalizeSummaryGeneration: vi.fn().mockResolvedValue({
  status: 'applied',
  meetingId,
  sourceServerRevision: 1,
  serverRevision: 2,
  updatedAt: '2026-06-06T10:01:00.000Z',
}),
```

Then replace success-path expectations for `meetings.updateMeetingSummary`,
`ai.markSummaryRequestCompleted`, and `assistant.settleRecap` with assertions
that finalization receives the request ID, original meeting revision, validated
summary, `now`, and provider usage. Add these tests:

```ts
it('returns atomic finalization sync metadata after provider success', async () => {
  const { ai, meetings, assistant, service } = createHarness({ withAssistantRepository: true });

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).resolves.toMatchObject({
    meetingSync: {
      meetingId,
      sourceServerRevision: 1,
      serverRevision: 2,
      updatedAt: '2026-06-06T10:01:00.000Z',
    },
  });

  expect(ai.finalizeSummaryGeneration).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId, requestId: 'request_1', meetingId, expectedServerRevision: 1,
    completedAt: now, generatedSummary: expect.objectContaining({ meetingId }),
  }));
  expect(meetings.updateMeetingSummary).not.toHaveBeenCalled();
  expect(ai.markSummaryRequestCompleted).not.toHaveBeenCalled();
  expect(assistant.settleRecap).not.toHaveBeenCalled();
});

it('keeps pending accounting intact when finalization outcome is uncertain', async () => {
  const finalizeError = new ApiError(500, 'ai_summary_request_finalization_failed', 'Unable to finalize AI summary generation.');
  const { ai, assistant, service } = createHarness({ withAssistantRepository: true });
  ai.finalizeSummaryGeneration.mockRejectedValueOnce(finalizeError);

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).rejects.toBe(finalizeError);
  expect(ai.markSummaryRequestFailed).not.toHaveBeenCalled();
  expect(assistant.releaseRecap).not.toHaveBeenCalled();
});

it('releases and fails a request after an atomic revision conflict without masking it', async () => {
  const { ai, assistant, service } = createHarness({ withAssistantRepository: true });
  ai.finalizeSummaryGeneration.mockResolvedValueOnce({
    status: 'revision_conflict', meetingId, sourceServerRevision: 1,
    serverRevision: null, updatedAt: null,
  });
  assistant.releaseRecap.mockRejectedValueOnce(new Error('cleanup transport failure'));

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now))).rejects.toMatchObject({
    statusCode: 409, code: 'meeting_update_conflict',
  });
  expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
    workspaceId, 'request_1', now, 'meeting_update_conflict',
  );
});
```

Add a logger assertion for the final test that a cleanup failure emits a safe
`ai_summary_generation_cleanup_failed` warning containing `workspaceId`,
`requestId`, and a safe operation/error code, and does not contain provider or
meeting text. Add an equivalent provider-error cleanup test where
`releaseRecap` and `markSummaryRequestFailed` each reject yet the original
`ai_summary_generation_failed` remains the returned error.

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```powershell
npm test -- tests/ai.service.test.ts
```

Expected: FAIL because the service still performs three separate success writes and does not expose the finalization port.

- [ ] **Step 3: Implement finalization and isolated cleanup behavior**

Update `AiRepositoryPort` to include `finalizeSummaryGeneration` and remove
`markSummaryRequestCompleted`; update `MeetingsRepositoryPort` so it retains
only `findMeetingByIdForWorkspace`; update `AssistantAllowanceRepository` so
it retains `releaseRecap` but not `settleRecap`.

After validated provider output, call the repository once:

```ts
const finalization = await this.aiRepository.finalizeSummaryGeneration({
  workspaceId: auth.workspaceId,
  requestId: summaryRequest.id,
  meetingId: meeting.id,
  expectedServerRevision: meeting.serverRevision,
  generatedSummary: toJsonValue(summary),
  completedAt: createdAt,
  usage,
});

if (finalization.status === 'revision_conflict') {
  await this.failRequestAndReleaseRecap(
    auth.workspaceId,
    summaryRequest.id,
    createdAt,
    'meeting_update_conflict',
    { workspaceId: auth.workspaceId, meetingId: meeting.id },
  );
  throw new ApiError(409, 'meeting_update_conflict', 'Meeting changed while saving summary.');
}

if (finalization.serverRevision === null || finalization.updatedAt === null) {
  throw new ApiError(500, 'ai_summary_request_finalization_invalid', 'Unable to finalize AI summary generation.');
}
```

Build the existing response from `summary`, `createdAt`, and the finalization
metadata. Do not catch a rejected `finalizeSummaryGeneration` inside the
pre-finalization cleanup path: a response timeout may mean the RPC committed,
so leaving the pending-or-completed state intact is required for safe claim
cache/recovery behavior.

Extract `failRequestAndReleaseRecap` as a private helper. It independently
attempts `markSummaryRequestFailed` and, when a credit was reserved,
`releaseRecap`. Each rejected cleanup call issues a safe `warn` log, then the
helper returns without throwing. Invoke this helper only after provider/output
validation failure, allowance/rate-limit failure after a reservation, or the
explicit `revision_conflict` result. The outer error handling must rethrow the
original `ApiError` or convert only a non-`ApiError` provider/validation error
to the existing `ai_summary_generation_failed` response.

For a returned `completed` finalization state, accept it only when it includes
the non-null sync fields; return the same success response without a provider
retry or another accounting write. Continue to log only safe request,
workspace, meeting, template, model, duration, and usage metadata on success.

- [ ] **Step 4: Run focused service tests to verify they pass**

Run:

```powershell
npm test -- tests/ai.service.test.ts tests/ai.repository.test.ts
```

Expected: PASS. Verify the completed-cache and pending-duplicate tests still
avoid provider work, and that no test expects the removed separate settlement
or completion calls.

- [ ] **Step 5: Review checkpoint**

Use `rg -n "updateMeetingSummary|markSummaryRequestCompleted|settleRecap" src/modules/ai tests/ai.service.test.ts` to confirm AI summary success no longer uses the old three-write path. Preserve the meetings-service use of `updateMeetingSummary`, which is unrelated. Do not stage or commit.

### Task 4: Verify the migration end-to-end and record only factual evidence

**Files:**
- Modify: `AI_RELEASE_CHECKLIST.md`
- Modify: `AI_READINESS_REVIEW.md`

**Interfaces:**
- Consumes: Passing test results from Tasks 1–3 and, only if configured, an isolated local Supabase instance.
- Produces: Accurate AI-07 implementation evidence and clearly labeled unrun environment-dependent checks.

- [ ] **Step 1: Add an isolated local database integration test when local Supabase credentials are available**

Create an integration test that seeds one workspace, completed meeting at
revision 1, pending request, and reserved credit; executes the finalization
RPC twice; and reads back the three rows. Assert: one meeting summary at
revision 2, one request with `status = 'completed'` and matching usage/cache,
and one `settled` credit. Seed a second request where the meeting is already
revision 2 and assert the RPC returns `revision_conflict` with all three rows
unchanged. Guard the file with the same explicit local-environment condition
used by existing migration integration tests; it must skip with a clear reason
when the isolated local database is absent, never fall back to staging or
production configuration.

- [ ] **Step 2: Run focused tests and static checks**

Run:

```powershell
npm test -- tests/ai-summary-generation-finalization.migration.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts tests/ai-summary-generation-claim.migration.test.ts tests/ai-stale-reservation-recovery.migration.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass. If a command fails on a pre-existing unrelated
baseline issue, capture its exact command and affected file(s); do not suppress
or reformat unrelated code to make it pass.

- [ ] **Step 3: Run the isolated local migration/integration check if and only if configured**

Run only after confirming a local Supabase environment exists and contains no
production credentials:

```powershell
npm run db:migrate:local:dry-run
npm run db:migrate:local
npm test -- tests/ai-summary-generation-finalization.integration.test.ts
```

Expected: migration applies locally and the test proves repeated finalization,
revision conflict rollback, and consistent request/credit/meeting rows. If the
environment is absent, do not run these commands and mark this test explicitly
unrun in the documentation.

- [ ] **Step 4: Update release evidence after verification**

Only after observing the results, append an AI-07 implementation update to
`AI_READINESS_REVIEW.md` and check completed automated items in the AI-07
section of `AI_RELEASE_CHECKLIST.md`. State the exact test/typecheck/build
outcomes, whether the local integration test passed or was skipped for missing
local configuration, and that staging/manual release scenarios remain open.
Do not mark AI-07 release acceptance complete without the required isolated
database and staging/manual evidence.

- [ ] **Step 5: Final review checkpoint**

Run:

```powershell
git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check
git -c safe.directory=D:/Projects/myself/weekly-us-api status --short
```

Expected: no whitespace errors; any pre-existing untracked user files remain
preserved. Report changed files and checks run. Do not stage or commit.

## Plan self-review

**Spec coverage:** Task 1 implements the single transaction, advisory lock,
workspace/role constraints, source-revision validation, idempotence, and
rolling-deployment migration. Task 2 defines the typed service boundary. Task
3 removes the three success writes, protects uncertain finalization from unsafe
cleanup, preserves original errors, and keeps provider work outside the
transaction. Task 4 covers fault/retry/recovery verification and truthful
release documentation.

**Placeholder scan:** No deferred implementation placeholders or unspecified
test cases remain. The one schema-name verification in Task 1
is a mandated read-before-write safeguard and gives the exact required edit if
the existing column differs.

**Type consistency:** `FinalizeAiSummaryGenerationInput` and
`AiSummaryGenerationFinalization` are defined in Task 2 and consumed using the
same method name and camelCase properties in Task 3. SQL parameters and
repository RPC parameters use the corresponding `p_*` names throughout.
