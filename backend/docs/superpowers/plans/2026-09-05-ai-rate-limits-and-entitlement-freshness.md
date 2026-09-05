# AI Rate Limits and Entitlement Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce five hourly new AI provider generations per adult user and 20 per workspace atomically, while resolving Premium recap allowance with the same trusted-entitlement policy used by subscription status.

**Architecture:** A new service-role-only `claim_ai_summary_generation_v3` PostgreSQL RPC serializes every workspace claim, returns cache/duplicate results before applying the hourly policy, and returns a typed rate-limit result with the true window expiry before inserting a new pending request. The repository and AI service consume that result instead of doing separate count/recheck queries. AI allowance resolution reuses `hasTrustedPremiumEntitlement`, so stale, expired, or missing Premium subscriptions fall back to the Free allowance exactly as billing status does.

**Tech Stack:** Node.js, TypeScript, Fastify, Supabase/PostgreSQL, Vitest.

## Global Constraints

- Keep anti-abuse limits at exactly `5` new provider generations per adult user and `20` per workspace during a rolling `3600`-second window.
- Cache hits and same-input pending duplicates do not consume hourly slots or recap credits. Rows marked `failed` do not count toward hourly slots; only `pending` and `completed` rows do.
- Preserve recap-credit limits and settlement behavior: Free `3` lifetime credits, Premium `20` credits per trusted `expiresAt` period, and no credit charge for cache hits or failed work.
- Keep all authorization, workspace scoping, safe errors, and response DTOs stable. Viewers must be rejected before any rate-limit state is disclosed.
- Resolve Premium only when `hasTrustedPremiumEntitlement(subscription, now)` is true. Otherwise resolve Free, including after expiry or a stale subscription verification.
- Add a new migration; do not edit existing migrations. Preserve old claim RPCs for rolling deployment compatibility.
- New RPCs must be `security definer`, use `set search_path = ''`, revoke execution from `public`, `anon`, and `authenticated`, and grant it only to `service_role`.
- Do not add dependencies, apply migrations outside an isolated local database, stage, commit, push, deploy, or make funded provider calls.
- Preserve unrelated pre-existing edits in `AI_READINESS_REVIEW.md` and `AI_RELEASE_CHECKLIST.md`.

---

## File Map

- Create `supabase/migrations/20260905130000_add_atomic_ai_summary_rate_limit_claim.sql`: additive v3 claim RPC with workspace locking, cache/duplicate bypass, rate-limit result, qualifying-status counts, and service-role grants.
- Create `tests/ai-summary-rate-limit-claim.migration.test.ts`: structural and security assertions for the v3 migration.
- Modify `src/modules/ai/ai.repository.ts`: define/marshal the v3 rate-limit claim result and call the v3 RPC with the exact policy values.
- Modify `src/modules/ai/ai.service.ts`: remove non-atomic count/recheck enforcement, turn a v3 rate-limit claim into the existing safe `429`, and apply `hasTrustedPremiumEntitlement` while resolving allowance.
- Modify `tests/ai.repository.test.ts`: assert v3 parameters and safe mapping/rejection of valid and malformed rate-limit results.
- Modify `tests/ai.service.test.ts`: cover 5/20 boundaries, cache/duplicate bypass, failure exclusion, role ordering, actual reset propagation, and trusted-Premium allowance selection.
- Modify `tests/subscriptions.service.test.ts`: retain/extend the shared freshness regression cases that status uses when RevenueCat refresh fails.
- Modify `docs/superpowers/specs/2026-08-29-recap-allowances-design.md`, `docs/superpowers/plans/2026-08-29-recap-and-household-limits.md`, `AI_READINESS_REVIEW.md`, and `AI_RELEASE_CHECKLIST.md`: change only AI-12/AI-13 policy wording and record implementation verification.

## Task 1: Add an atomic, versioned rate-limit claim RPC

**Files:**
- Create: `supabase/migrations/20260905130000_add_atomic_ai_summary_rate_limit_claim.sql`
- Create: `tests/ai-summary-rate-limit-claim.migration.test.ts`

**Interfaces:**
- Produces `claim_ai_summary_generation_v3(uuid, uuid, uuid, text, text, text, text, integer, integer, integer)`.
- Its `claim_status` is one of `created`, `pending`, `completed`, or `rate_limited`.
- A `rate_limited` row has `rate_limit_scope` of `user` or `workspace`, a non-null `rate_limit_reset_at`, and null request columns.
- New requests count only rows in the same workspace with `status in ('pending', 'completed')` and `created_at > clock_timestamp() - make_interval(secs => p_window_seconds)`.

- [ ] **Step 1: Write failing migration-contract tests.**

```ts
const sql = readFileSync(
  resolve('supabase/migrations/20260905130000_add_atomic_ai_summary_rate_limit_claim.sql'),
  'utf8',
);

expect(sql).toContain('public.claim_ai_summary_generation_v3');
expect(sql).toContain('p_user_limit integer');
expect(sql).toContain('p_workspace_limit integer');
expect(sql).toContain('p_window_seconds integer');
expect(sql).toContain("status in ('pending', 'completed')");
expect(sql).toContain("'rate_limited'");
expect(sql).toContain('rate_limit_reset_at');
expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0))");
expect(sql).toContain("set search_path = ''");
expect(sql).toContain('from public, anon, authenticated');
expect(sql).toContain('to service_role');
```

- [ ] **Step 2: Run the new structural test and verify it fails because the migration is absent.**

Run: `npm test -- tests/ai-summary-rate-limit-claim.migration.test.ts`

Expected: FAIL with an `ENOENT` read of `20260905130000_add_atomic_ai_summary_rate_limit_claim.sql`.

- [ ] **Step 3: Implement the additive v3 migration.**

Create a new function instead of replacing v2 so a backend rolling deploy can continue serving old callers. Use one workspace-wide advisory lock before checking cache, duplicate, and limits; do not use v2's meeting/input-specific lock because it cannot serialize distinct concurrent requests in the same workspace.

The function signature and result must include the exact policy inputs and rate-limit metadata:

```sql
create function public.claim_ai_summary_generation_v3(
  p_workspace_id uuid,
  p_meeting_id uuid,
  p_user_id uuid,
  p_provider text,
  p_input_hash text,
  p_effective_model text,
  p_prompt_version text,
  p_user_limit integer,
  p_workspace_limit integer,
  p_window_seconds integer
)
returns table (
  claim_status text,
  rate_limit_scope text,
  rate_limit_reset_at timestamptz,
  id uuid,
  workspace_id uuid,
  user_id uuid,
  meeting_id uuid,
  provider text,
  status text,
  input_hash text,
  effective_model text,
  prompt_version text,
  created_at timestamptz,
  completed_at timestamptz,
  error_code text,
  generated_summary jsonb
)
language plpgsql
security definer
set search_path = '';
```

Reject null/nonpositive limits or window values with `22023`. Retain the existing v2 completed-cache lookup, then pending-duplicate lookup, before creating a `v_window_start := clock_timestamp() - make_interval(secs => p_window_seconds)`. For a new input, derive each scope's oldest active request and count using a single aggregate query:

```sql
select
  count(*) filter (where request.user_id = p_user_id),
  min(request.created_at) filter (where request.user_id = p_user_id),
  count(*),
  min(request.created_at)
into v_user_count, v_user_oldest, v_workspace_count, v_workspace_oldest
from public.ai_summary_requests as request
where request.workspace_id = p_workspace_id
  and request.status in ('pending', 'completed')
  and request.created_at > v_window_start;
```

When the user is at/above `p_user_limit`, return `rate_limited`, `user`, and `v_user_oldest + make_interval(secs => p_window_seconds)` with all request fields null. Otherwise, when the workspace is at/above `p_workspace_limit`, return the same shape with `workspace` and `v_workspace_oldest`. Only below both limits insert the new `pending` row and return `created`. Preserve v2's cache/pending ordering and all original row fields. Revoke/grant execution for the full v3 signature.

- [ ] **Step 4: Run the migration-contract test.**

Run: `npm test -- tests/ai-summary-rate-limit-claim.migration.test.ts`

Expected: PASS; it confirms the versioned function, qualifying states, workspace lock, and service-role restriction are present.

- [ ] **Step 5: Review migration safety.**

Confirm the migration only creates v3 and grants; it does not drop v1/v2, alter historical `ai_summary_requests` rows, weaken RLS, or grant client execution.

## Task 2: Map the v3 result in the repository

**Files:**
- Modify: `src/modules/ai/ai.repository.ts`
- Modify: `tests/ai.repository.test.ts`

**Interfaces:**
- `AiSummaryGenerationClaim` becomes a discriminated union:

```ts
type AiSummaryGenerationClaim =
  | { status: 'created' | 'pending' | 'completed'; request: AiSummaryRequestRecord }
  | { status: 'rate_limited'; scope: 'user' | 'workspace'; resetAt: string };
```

- `claimSummaryGeneration` sends `p_user_limit: 5`, `p_workspace_limit: 20`, and `p_window_seconds: 3600` to v3.

- [ ] **Step 1: Add repository tests for the rate-limit result and v3 call.**

```ts
const rateLimitedRow = {
  claim_status: 'rate_limited',
  rate_limit_scope: 'workspace',
  rate_limit_reset_at: '2026-06-06T10:17:00.000Z',
  id: null, workspace_id: null, user_id: null, meeting_id: null,
  provider: null, status: null, input_hash: null, effective_model: null,
  prompt_version: null, created_at: null, completed_at: null,
  error_code: null, generated_summary: null,
};

await expect(repository.claimSummaryGeneration(input)).resolves.toEqual({
  status: 'rate_limited', scope: 'workspace', resetAt: '2026-06-06T10:17:00.000Z',
});
expect(rpc).toHaveBeenCalledWith('claim_ai_summary_generation_v3', {
  ...expectedClaimParams,
  p_user_limit: 5,
  p_workspace_limit: 20,
  p_window_seconds: 3600,
});
```

Add malformed-result tests for an unknown claim status, missing reset timestamp, and unknown scope. All must reject as `500 ai_summary_request_claim_invalid` without exposing RPC detail.

- [ ] **Step 2: Run the focused repository test to verify failure.**

Run: `npm test -- tests/ai.repository.test.ts`

Expected: FAIL because v2 is called and the current type requires a request for every result.

- [ ] **Step 3: Implement typed v3 mapping.**

Define nullable v3 RPC row fields separately from `AiSummaryRequestRow`. Check `claim_status === 'rate_limited'` first, permit only `user`/`workspace`, require a parsable non-null reset, and return the rate-limit branch. For `created`, `pending`, and `completed`, require the request row values before calling `mapAiSummaryRequestRowToRecord`. Unknown/malformed rows must throw the existing safe claim-invalid `ApiError`.

```ts
if (row.claim_status === 'rate_limited') {
  if (
    (row.rate_limit_scope !== 'user' && row.rate_limit_scope !== 'workspace') ||
    row.rate_limit_reset_at === null
  ) {
    throw new ApiError(500, 'ai_summary_request_claim_invalid', 'Unable to claim AI summary generation.');
  }
  return {
    status: 'rate_limited',
    scope: row.rate_limit_scope,
    resetAt: formatApiDateTime(row.rate_limit_reset_at),
  };
}
```

- [ ] **Step 4: Run repository tests.**

Run: `npm test -- tests/ai.repository.test.ts`

Expected: PASS for created/cache/duplicate records, rate-limited records, and malformed RPC output.

## Task 3: Use atomic limits and trusted entitlement in AI generation

**Files:**
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `tests/ai.service.test.ts`
- Modify: `tests/subscriptions.service.test.ts`

**Interfaces:**
- `AiSummaryService` receives `rate_limited` from `claimSummaryGeneration` and throws the existing `ApiError(429, 'ai_summary_rate_limited', ...)` without reserving credits, marking a request failed, or calling the provider.
- `resolveAllowance` chooses `premium` only when `hasTrustedPremiumEntitlement(subscription, now)` is true.

- [ ] **Step 1: Replace old service expectations with atomic-claim cases.**

Extend the AI harness so `claim` accepts the new rate-limited union and it passes a `subscriptionsRepository` when `withAssistantRepository` is true. Delete the test setup based on `userCount`, `workspaceCount`, and the two repository count methods.

```ts
claim: {
  status: 'rate_limited',
  scope: 'user',
  resetAt: '2026-06-06T10:17:00.000Z',
}

await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now)))
  .rejects.toMatchObject({
    statusCode: 429,
    code: 'ai_summary_rate_limited',
    details: {
      userLimit: 5, workspaceLimit: 20, windowSeconds: 3600,
      scope: 'user', remaining: 0, resetAt: '2026-06-06T10:17:00.000Z',
    },
  });
expect(assistant.reserveRecap).not.toHaveBeenCalled();
expect(ai.markSummaryRequestFailed).not.toHaveBeenCalled();
expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
```

Add equivalent workspace scope coverage. Preserve and extend the completed-cache and pending-duplicate tests to assert the rate-limit result is never needed for those branches. Add provider error and revision-conflict cases that confirm the request is marked `failed`; the migration's qualifying-status rule is what excludes those failures.

- [ ] **Step 2: Add trusted-entitlement allowance regressions.**

Use the AI harness with an assistant repository and subscription repository to prove generation aligns with status:

```ts
const stalePremium = subscription({
  planType: 'premium', status: 'active', expiresAt: future,
  lastCheckedAt: '2026-06-04T09:59:59.000Z',
});

await service.generateMeetingSummary(auth, { meetingId }, new Date(now));
expect(assistant.countUsedRecaps).toHaveBeenCalledWith(workspaceId, null);
expect(assistant.reserveRecap).toHaveBeenCalledWith(
  workspaceId, 'request_1', null, 3,
);
```

Add recently checked Premium expectation using `future` as `periodEndsAt` and limit `20`; expired Premium and missing subscription must match the Free case; a different fresh `expiresAt` must count only that new period. Keep the existing billing tests proving `cachedOrFreeStatus` returns Free for a stale record and Premium for a fresh record; add `assistantRecap.periodEndsAt`/usage assertions where they are missing.

- [ ] **Step 3: Run focused tests to verify failure.**

Run: `npm test -- tests/ai.service.test.ts tests/subscriptions.service.test.ts`

Expected: FAIL while service performs pre/post count queries and `resolveAllowance` calls `resolveEffectivePlan` without freshness validation.

- [ ] **Step 4: Implement the service changes.**

Remove `countRecentSummaryRequestsForWorkspace` and `countRecentSummaryRequestsForUserInWorkspace` from `AiRepositoryPort`; remove `requireWithinRateLimits` and `requireReservedRequestWithinRateLimits`. Immediately after `claimSummaryGeneration`, branch before reading `claim.request`:

```ts
if (claim.status === 'rate_limited') {
  throw new ApiError(429, 'ai_summary_rate_limited',
    'Please wait before generating another AI summary.', {
      userLimit: 5,
      workspaceLimit: 20,
      windowSeconds: 3600,
      scope: claim.scope,
      remaining: 0,
      resetAt: claim.resetAt,
    });
}
```

Remove the second rate check after recap reservation. Import `hasTrustedPremiumEntitlement` from `../billing/feature-access.js` and replace the allowance plan calculation with:

```ts
const planType = hasTrustedPremiumEntitlement(subscription, now)
  ? 'premium'
  : 'free';
const periodEndsAt = planType === 'premium' ? subscription?.expiresAt ?? null : null;
```

Retain existing `reconcileAbandonedRecaps`, allowance calculation, reservation, finalization, release, and safe logging behavior. Do not pass raw subscription/provider information into errors or logs.

- [ ] **Step 5: Run focused service and subscription tests.**

Run: `npm test -- tests/ai.service.test.ts tests/subscriptions.service.test.ts`

Expected: PASS for rate-limit response metadata, no provider/credit work after a rate-limited claim, cached/duplicate behavior, failure cleanup, stale/expired Free fallback, and fresh Premium period use.

## Task 4: Validate database behavior and update the AI record

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-recap-allowances-design.md`
- Modify: `docs/superpowers/plans/2026-08-29-recap-and-household-limits.md`
- Modify: `AI_READINESS_REVIEW.md`
- Modify: `AI_RELEASE_CHECKLIST.md`
- Verify: `tests/ai-summary-rate-limit-claim.migration.test.ts`, `tests/ai.repository.test.ts`, `tests/ai.service.test.ts`, `tests/subscriptions.service.test.ts`

**Interfaces:**
- Documentation states the implemented hourly policy as 5/user and 20/workspace, specifies qualifying states/cache/failure semantics, and records that Premium is trusted only within 24 hours.

- [ ] **Step 1: Add or adapt isolated local-Supabase coverage when test credentials are available.**

In the existing guarded local database integration convention, create 20 distinct current-window pending/completed claims across users in one workspace and assert the 21st receives `workspace` with `resetAt = oldest_created_at + interval '1 hour'`. Separately create five qualifying rows for one adult and assert their sixth request receives `user`. Assert rows just outside the window and rows with `status = 'failed'` do not count. Use a second workspace to prove isolation.

- [ ] **Step 2: Run focused automated verification.**

Run:

```powershell
npm test -- tests/ai-summary-rate-limit-claim.migration.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts tests/subscriptions.service.test.ts
npm run typecheck
npm test
npm run build
npm run openapi:check
```

Expected: all checks pass. If isolated Supabase credentials are unavailable, keep the integration test explicitly skipped with its existing guard and record that local database and staging verification remain open.

- [ ] **Step 3: Update documentation without overwriting unrelated edits.**

First inspect the current diffs for `AI_READINESS_REVIEW.md` and `AI_RELEASE_CHECKLIST.md`. Change only AI-12/AI-13 text: the August policy's 3/8 hourly value becomes the approved 5/20; cache/duplicate/failure semantics and true reset time are stated; and the trusted Premium fallback rule is marked implemented only after all preceding checks pass. Record exact command outcomes, skipped integration conditions, and remaining staging/manual verification.

- [ ] **Step 4: Review migration and operational safety.**

Verify the final migration preserves v1/v2 functions, scopes every query by `workspace_id`, locks the whole workspace for the count/insert decision, does not return internal request data in the rate-limited branch, and leaves the external provider call outside every database transaction. Before release, run the migration against an isolated local Supabase database and then staging; verify five/six and 20/21 boundaries, stale Premium fallback, expiry, and renewal-period credit separation.
