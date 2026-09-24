# AI Stale Reservation Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover abandoned AI summary requests and their stale recap reservations before they can permanently consume Free or Premium allowance.

**Architecture:** A new service-role-only Supabase RPC atomically reconciles stale, workspace-scoped pending AI requests while holding the existing workspace credit advisory lock. The assistant repository exposes that RPC, and both the AI generation flow and subscription-status flow call it before claim/count operations so they report the same allowance. AI-07 atomic finalization remains out of scope.

**Tech Stack:** Node.js, TypeScript, Fastify, Supabase/PostgreSQL PL/pgSQL, Vitest, Supabase JS.

## Global Constraints

- Use a new migration named `supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql`; never edit an applied migration.
- A request is recoverable only when it is `pending` and older than 15 minutes, with no linked reservation or with a linked `reserved` reservation older than 15 minutes.
- Recovery writes `status = 'failed'`, `completed_at`, and `error_code = 'ai_summary_request_abandoned'`; it never deletes audit rows or retries OpenAI.
- Release only the recoverable request's exact linked `reserved` credit; do not change active, completed, failed, settled, released, cross-workspace, or non-expired rows.
- Preserve workspace authorization, adult-only generation, private-note exclusion, allowance DTOs, and safe error responses. Never log provider prompts, meeting contents, credentials, or raw database errors.
- Do not hold a database transaction across an OpenAI request. The reservation RPC remains the concurrency authority for creating reservations.
- Preserve a completed request with a still-reserved credit for AI-07; do not release it during this task.
- Local database integration tests may use only `SUPABASE_LOCAL_URL` with a `localhost` or `127.0.0.1` host and `SUPABASE_LOCAL_SERVICE_ROLE_KEY`. They must skip when those values are absent.
- Do not stage, commit, push, deploy, or apply migrations to staging/production. The user has not authorized Git or external-environment mutations.

---

## File structure

- Create: `supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql` — reconciliation RPC and the backward-compatible reservation-RPC replacement.
- Create: `tests/ai-stale-reservation-recovery.migration.test.ts` — static migration safety and contract assertions.
- Create: `tests/assistant.repository.test.ts` — repository RPC-wrapper behavior and safe error mapping.
- Create: `tests/ai-stale-reservation-recovery.integration.test.ts` — isolated-local-Supabase recovery behavior, skipped without local credentials.
- Modify: `src/modules/assistant/assistant.repository.ts` — typed `reconcileAbandonedRecaps` wrapper.
- Modify: `src/modules/ai/ai.service.ts` — reconciliation before the AI-05 claim operation.
- Modify: `src/modules/billing/billing.service.ts` — reconciliation before every recap allowance count, including fallback defaults.
- Modify: `tests/ai.service.test.ts` — generation ordering and recovery-failure regressions.
- Modify: `tests/subscriptions.service.test.ts` — Free and Premium status ordering and recovery-failure regressions.
- Modify after verified implementation: `AI_READINESS_REVIEW.md`, `AI_RELEASE_CHECKLIST.md`, and this plan — record only observed automated/local integration results and remaining manual/staging release checks.

## Interfaces

```ts
// src/modules/assistant/assistant.repository.ts
class AssistantRepository {
  async reconcileAbandonedRecaps(workspaceId: string): Promise<void>;
}

// src/modules/ai/ai.service.ts
type AssistantAllowanceRepository = Pick<AssistantRepository,
  'countUsedRecaps' | 'reconcileAbandonedRecaps' | 'reserveRecap' | 'settleRecap' | 'releaseRecap'
>;

// src/modules/billing/billing.service.ts
type AssistantCreditRepository = Pick<AssistantRepository,
  'countUsedRecaps' | 'reconcileAbandonedRecaps'
>;
```

```sql
public.reconcile_abandoned_assistant_recap_requests(
  p_workspace_id uuid
) returns void
```

The RPC must be invocable only by `service_role`. It marks eligible request rows failed and releases eligible linked reservation rows within the same RPC transaction. The RPC takes no user-supplied timeout or period; it uses the established `interval '15 minutes'` and each reservation's stored `allowance_period_ends_at`.

### Task 1: Define and validate the recovery database contract

**Files:**
- Create: `tests/ai-stale-reservation-recovery.migration.test.ts`
- Create: `supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql`

**Consumes:** Existing `ai_summary_requests`, `assistant_recap_credit_reservations`, `reserve_assistant_recap_credit`, and `hashtextextended` workspace locking.

**Produces:** The service-role-only reconciliation RPC and a reservation RPC that invokes it before count/insert logic.

- [ ] **Step 1: Write the failing migration-contract test.**

```ts
const sql = readFileSync(
  resolve('supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql'),
  'utf8',
);

expect(sql).toContain('public.reconcile_abandoned_assistant_recap_requests');
expect(sql).toContain("interval '15 minutes'");
expect(sql).toContain("'ai_summary_request_abandoned'");
expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))');
expect(sql).toContain("request.status = 'pending'");
expect(sql).toContain("credit.state = 'reserved'");
expect(sql).toContain('credit.ai_summary_request_id = request.id');
expect(sql).toContain('from public, anon, authenticated');
expect(sql).toContain('to service_role');
expect(sql).toContain('perform public.reconcile_abandoned_assistant_recap_requests(p_workspace_id)');
```

Add assertions that the migration uses `security definer`, `set search_path = ''`, does not contain `delete from public.ai_summary_requests`, and leaves the reservation state predicate limited to `reserved`.

- [ ] **Step 2: Run the migration-contract test to verify it fails.**

Run: `npm test -- tests/ai-stale-reservation-recovery.migration.test.ts`

Expected: FAIL because the new migration file does not exist.

- [ ] **Step 3: Add the migration.**

Implement `reconcile_abandoned_assistant_recap_requests` exactly as a `language plpgsql`, `security definer`, `set search_path = ''` function with this recovery statement:

```sql
create or replace function public.reconcile_abandoned_assistant_recap_requests(
  p_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'workspace ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  with recovered_requests as (
    update public.ai_summary_requests as request
    set status = 'failed',
        completed_at = clock_timestamp(),
        error_code = 'ai_summary_request_abandoned'
    where request.workspace_id = p_workspace_id
      and request.status = 'pending'
      and request.created_at < clock_timestamp() - interval '15 minutes'
      and not exists (
        select 1
        from public.assistant_recap_credit_reservations as credit
        where credit.workspace_id = request.workspace_id
          and credit.ai_summary_request_id = request.id
          and (
            credit.state <> 'reserved'
            or credit.reserved_at >= clock_timestamp() - interval '15 minutes'
          )
      )
    returning request.id
  )
  update public.assistant_recap_credit_reservations as credit
  set state = 'released', released_at = clock_timestamp()
  from recovered_requests
  where credit.workspace_id = p_workspace_id
    and credit.ai_summary_request_id = recovered_requests.id
    and credit.state = 'reserved'
    and credit.reserved_at < clock_timestamp() - interval '15 minutes';
end;
$$;
```

Follow the function with:

```sql
revoke all on function public.reconcile_abandoned_assistant_recap_requests(uuid)
  from public, anon, authenticated;

grant execute on function public.reconcile_abandoned_assistant_recap_requests(uuid)
  to service_role;
```

Then recreate `reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer)` with this full body, retaining its validation, period-aware count, and idempotency while delegating stale handling to reconciliation:

```sql
create or replace function public.reserve_assistant_recap_credit(
  p_workspace_id uuid,
  p_ai_summary_request_id uuid,
  p_allowance_period_ends_at timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_active_credit_count integer;
begin
  if p_workspace_id is null or p_ai_summary_request_id is null or p_limit < 1 then
    raise exception using errcode = '22023', message = 'invalid recap allowance input';
  end if;

  perform public.reconcile_abandoned_assistant_recap_requests(p_workspace_id);
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  select state into v_state
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id
  for update;

  if found then
    return v_state in ('reserved', 'settled');
  end if;

  select count(*) into v_active_credit_count
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and allowance_period_ends_at is not distinct from p_allowance_period_ends_at
    and state in ('reserved', 'settled');

  if v_active_credit_count >= p_limit then
    return false;
  end if;

  insert into public.assistant_recap_credit_reservations (
    workspace_id, ai_summary_request_id, state, allowance_period_ends_at
  ) values (
    p_workspace_id, p_ai_summary_request_id, 'reserved', p_allowance_period_ends_at
  );

  return true;
end;
$$;
```

Retain the existing revoke/grant statements for this signature after the replacement. Do not retain the old direct stale-reservation update: the reconciliation function is the sole stale-state policy. The nested and outer transaction advisory locks use the same workspace key, preserving concurrent-reservation semantics.

- [ ] **Step 4: Run the migration-contract test to verify it passes.**

Run: `npm test -- tests/ai-stale-reservation-recovery.migration.test.ts`

Expected: PASS.

### Task 2: Expose reconciliation through the assistant repository

**Files:**
- Create: `tests/assistant.repository.test.ts`
- Modify: `src/modules/assistant/assistant.repository.ts`

**Consumes:** `public.reconcile_abandoned_assistant_recap_requests(p_workspace_id uuid)` from Task 1 and `throwOnSupabaseError`.

**Produces:** `AssistantRepository.reconcileAbandonedRecaps(workspaceId): Promise<void>` for AI and billing services.

- [ ] **Step 1: Write failing repository tests.**

```ts
it('reconciles stale recap work through the workspace-scoped RPC', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const repository = new AssistantRepository({ rpc } as never);

  await expect(repository.reconcileAbandonedRecaps(workspaceId)).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledWith('reconcile_abandoned_assistant_recap_requests', {
    p_workspace_id: workspaceId,
  });
});

it('maps reconciliation database failures without exposing database details', async () => {
  const repository = new AssistantRepository({
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'internal SQL detail' } }),
  } as never);

  await expect(repository.reconcileAbandonedRecaps(workspaceId)).rejects.toMatchObject({
    code: 'assistant_recap_recovery_failed',
  });
});
```

- [ ] **Step 2: Run the repository tests to verify they fail.**

Run: `npm test -- tests/assistant.repository.test.ts`

Expected: FAIL because `reconcileAbandonedRecaps` does not exist.

- [ ] **Step 3: Implement the wrapper.**

Add the method immediately before `countUsedRecaps`:

```ts
async reconcileAbandonedRecaps(workspaceId: string): Promise<void> {
  const { error } = await this.supabase.rpc(
    'reconcile_abandoned_assistant_recap_requests',
    { p_workspace_id: workspaceId },
  );

  throwOnSupabaseError(
    error,
    'assistant_recap_recovery_failed',
    'Unable to recover AI recap credits.',
  );
}
```

Do not return recovery counts to clients or log the underlying error.

- [ ] **Step 4: Run repository and migration-contract tests.**

Run: `npm test -- tests/assistant.repository.test.ts tests/ai-stale-reservation-recovery.migration.test.ts`

Expected: PASS.

### Task 3: Recover before AI claiming and allowance counting

**Files:**
- Modify: `tests/ai.service.test.ts`
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `tests/subscriptions.service.test.ts`
- Modify: `src/modules/billing/billing.service.ts`

**Consumes:** `AssistantRepository.reconcileAbandonedRecaps` from Task 2.

**Produces:** Generation and subscription status execute reconciliation before request claiming or recap-credit counting.

- [ ] **Step 1: Add failing AI-service regressions.**

Extend `createHarness` to inject an `assistantRepository` mock and pass it to `AiSummaryService`. Add this normal-path order test:

```ts
it('reconciles abandoned recap work before claiming summary generation', async () => {
  const { ai, assistant, service } = createHarness();

  await service.generateMeetingSummary(auth, { meetingId }, new Date(now));

  expect(assistant.reconcileAbandonedRecaps).toHaveBeenCalledWith(workspaceId);
  expect(
    assistant.reconcileAbandonedRecaps.mock.invocationCallOrder[0],
  ).toBeLessThan(ai.claimSummaryGeneration.mock.invocationCallOrder[0]);
});
```

Add a rejection test in which `assistant.reconcileAbandonedRecaps` rejects with a safe `ApiError`. Assert `claimSummaryGeneration`, `reserveRecap`, and `provider.generateMeetingSummary` were not called and the same safe error is rethrown. Keep the existing no-assistant-repository constructor path working without a recovery call.

- [ ] **Step 2: Add failing subscription-status regressions.**

Extend `serviceWith` so it accepts a fake assistant-credit repository with `reconcileAbandonedRecaps` and `countUsedRecaps` spies. Add one Free/no-subscription test and one active-Premium test that assert recovery is called with `workspace-1` before `countUsedRecaps`. Add a recovery-failure test that rejects `getStatus` with the safe recovery error and verifies `countUsedRecaps` is not called.

- [ ] **Step 3: Run the focused service tests to verify they fail.**

Run: `npm test -- tests/ai.service.test.ts tests/subscriptions.service.test.ts`

Expected: FAIL because neither service calls `reconcileAbandonedRecaps` and the billing test fake lacks the new interface member.

- [ ] **Step 4: Implement AI-service recovery ordering.**

Update `AssistantAllowanceRepository` to include `reconcileAbandonedRecaps`. After the meeting has been found, revision-checked, and confirmed completed, invoke recovery before `requireWithinRateLimits`, prompt construction, and `claimSummaryGeneration`:

```ts
if (this.assistantRepository) {
  await this.assistantRepository.reconcileAbandonedRecaps(auth.workspaceId);
}
```

Do not catch this call locally. Its safe repository error must abort before the provider, claim, or reservation. Do not invoke recovery for an unauthenticated/viewer, missing, stale-revision, unfinished, or unconfigured-AI request.

- [ ] **Step 5: Implement billing-status recovery ordering.**

Add `reconcileAbandonedRecaps` to `AssistantCreditRepository` and to the constructor's default no-op object:

```ts
async reconcileAbandonedRecaps() {
  return undefined;
},
```

In `subscriptionStatusFromRecord` and `freeStatus`, await recovery immediately before every `countUsedRecaps` call. This covers cached Free/Premium status, fresh RevenueCat status, restore fallback, and provider-refresh fallback because each path reaches one of those two functions. Do not run recovery in `getManageUrl` or webhook-only `syncEntitlementForWorkspace` paths that return no mobile status.

- [ ] **Step 6: Run focused service tests to verify they pass.**

Run: `npm test -- tests/ai.service.test.ts tests/subscriptions.service.test.ts`

Expected: PASS, including the existing authorization and allowance regressions.

### Task 4: Verify the real RPC against an isolated local Supabase database

**Files:**
- Create: `tests/ai-stale-reservation-recovery.integration.test.ts`

**Consumes:** Task 1 migration and the local-test environment guard pattern in `tests/ai-summary-generation-claim.integration.test.ts`.

**Produces:** Optional local integration evidence for stale Free/Premium recovery, idempotency, and active/settled preservation.

- [ ] **Step 1: Write the skipped-by-default integration fixture and assertions.**

Use the established guard:

```ts
const describeLocal = canRunLocally ? describe : describe.skip;
```

Create unique user, workspace, and completed meeting fixtures. Insert five `ai_summary_requests` with corresponding credits:

1. Free stale `pending` request plus a Free (`allowance_period_ends_at = null`) stale `reserved` credit.
2. Premium stale `pending` request plus a stale `reserved` credit for the fixture's future Premium period.
3. A current `pending` request plus a current `reserved` credit.
4. A completed request plus a `settled` credit.
5. A pending request in a second workspace plus a stale reserved credit.

Backdate only the stale request `created_at` and credit `reserved_at` to more than 15 minutes ago. Call the reconciliation RPC twice for the first workspace. Assert the first two request rows are `failed` with `error_code = 'ai_summary_request_abandoned'`, their credits are `released`, the current and settled rows are unchanged, and the second-workspace rows are unchanged after both calls. Then call `claim_ai_summary_generation` using the first stale request's identity and assert it returns `created`, proving stale AI-05 claims no longer block retries.

- [ ] **Step 2: Run the integration test without local credentials.**

Run: `npm test -- tests/ai-stale-reservation-recovery.integration.test.ts`

Expected: SKIP when `SUPABASE_LOCAL_URL` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY` are absent or the URL host is not local; no network call is made.

- [ ] **Step 3: If an isolated local Supabase instance is explicitly available, apply migrations locally and rerun.**

Run: `npm test -- tests/ai-stale-reservation-recovery.integration.test.ts`

Expected: PASS with the five asserted states. Do not use staging or production credentials. If no isolated local database exists, record the skipped result and leave the checklist's local integration item open.

### Task 5: Run project checks and record only verified evidence

**Files:**
- Modify after verified results: `AI_READINESS_REVIEW.md`
- Modify after verified results: `AI_RELEASE_CHECKLIST.md`
- Modify after verified results: `docs/superpowers/specs/2026-09-04-ai-stale-reservation-recovery-design.md`
- Modify after verified results: `docs/superpowers/plans/2026-09-04-ai-stale-reservation-recovery.md`

**Consumes:** Passing focused tests from Tasks 1–3 and, when available, Task 4's local integration result.

**Produces:** Accurate implementation evidence without claiming release, staging, provider, or device validation.

- [ ] **Step 1: Run focused AI/repository/migration tests.**

Run:

```powershell
npm test -- tests/assistant.repository.test.ts tests/ai.service.test.ts tests/subscriptions.service.test.ts tests/ai-stale-reservation-recovery.migration.test.ts tests/ai-stale-reservation-recovery.integration.test.ts
```

Expected: All executable tests PASS; the integration suite is explicitly reported as SKIP unless an isolated local Supabase database was used.

- [ ] **Step 2: Run TypeScript and build checks.**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: PASS. If an existing unrelated failure occurs, preserve it and record its exact command/result instead of weakening a check.

- [ ] **Step 3: Update evidence documents truthfully.**

In the review and checklist, mark only the automated sub-items with direct passing evidence. Record the command names, relevant test counts/results, whether the local integration test passed or skipped, and retain staging, migration-order, manual interruption, and release-signoff items as open. Add an implementation-result section to the design and plan with the same evidence. Do not mark AI-06 resolved unless the local integration behavior is verified; never claim deployment, provider calls, staging, or production work.

- [ ] **Step 4: Inspect the final diff.**

Run:

```powershell
git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check
git -c safe.directory=D:/Projects/myself/weekly-us-api diff -- src/modules/assistant/assistant.repository.ts src/modules/ai/ai.service.ts src/modules/billing/billing.service.ts supabase/migrations/20260904140000_add_ai_stale_recap_recovery.sql tests/assistant.repository.test.ts tests/ai-stale-reservation-recovery.migration.test.ts tests/ai-stale-reservation-recovery.integration.test.ts tests/ai.service.test.ts tests/subscriptions.service.test.ts
```

Expected: no whitespace errors and no unrelated source changes. Leave the working tree unstaged.

## Plan self-review

Spec coverage: Task 1 supplies the locked, service-role-only, idempotent request/credit recovery and preserves existing reservation atomicity. Task 2 creates the only application wrapper. Task 3 ensures status and generation share recovery policy without broadening authorization. Task 4 verifies Free, Premium, active, settled, cross-workspace, retry, and idempotency behavior on an isolated local database. Task 5 records only observed evidence and keeps all deployment/manual release gates open.

Placeholder scan: no TBD/TODO items or undefined interfaces remain. The migration function, repository method, error code, timeout, predicates, tests, commands, and verification boundaries are specified above.

Type consistency: `reconcileAbandonedRecaps(workspaceId): Promise<void>` is the same interface used by the repository, AI service, billing service, and test fakes. The SQL RPC parameter is consistently `p_workspace_id uuid`.

## Execution result

Implemented inline on 2026-09-04. The focused suite reports 62 passing tests
and one guarded local-Supabase integration test skipped because local
credentials are absent. The full backend suite, `npm run typecheck`, and
`npm run build` pass. No Git staging/commit/push, deployment, provider call,
or database migration outside an isolated local environment was performed.
