# Recap and Household Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce three lifetime Free AI recaps or 20 Premium recaps per renewal period, show the remaining allowance in the app, and cap active household members at four Free or eight Premium members.

**Architecture:** Evolve the existing recap reservation table and service-role RPCs with an additive migration so a workspace allowance can be reserved atomically before an AI provider call. Derive the current allowance from the trusted subscription record in one backend helper and expose it through the subscription snapshot. Extend the existing invitation RPCs to derive the same effective plan inside PostgreSQL and reject capacity overflows atomically; the mobile app renders both derived statuses and handles server rejections without removing existing members after expiry.

**Tech Stack:** Node.js, Fastify, TypeScript, Zod, Supabase/PostgreSQL, Vitest; Vue 3, Pinia, vue-i18n, Vue Test Utils.

## Global Constraints

- Free: exactly `3` lifetime, workspace-scoped recap generations and `4` active signed-in workspace members, including the owner.
- Premium: exactly `20` new recap generations for each trusted subscription period and `8` active signed-in workspace members, including the owner.
- Premium recap credits reset at the entitlement `expiresAt`; unused credits never roll over. A Free recap allowance has no expiry.
- A cache hit, saved-recap view, or provider/save failure does not consume an additional recap credit.
- Only `owner` and `adult_member` may generate recaps. Existing users and data are never removed after a downgrade.
- Enforce member capacity at both invitation creation and invitation acceptance. Pending invitations never consume capacity.
- Use new migrations only; do not edit `20260825120000_create_premium_assistant_schema.sql` or `20260826180000_add_participant_identity_invitations.sql`.
- Every workspace-owned query remains scoped by `workspace_id`; service-role RPCs are not callable by browser clients.
- Do not add dependencies, stage files, or commit.

---

## File Map

### Backend and database (`D:/Projects/myself/weekly-us-api`)

- Create `supabase/migrations/20260829120000_add_recap_allowances_and_member_caps.sql`: additive recap-reservation fields and overload, plus replacement invitation RPCs that enforce effective-plan member capacity atomically.
- Create `src/modules/billing/plan-limits.ts`: the two recap and member limits and pure plan-to-limit helpers shared by billing, AI, and workspace services.
- Modify `src/modules/assistant/assistant.repository.ts`: count allowance usage and call reserve/settle/release RPCs with the current allowance window.
- Modify `src/modules/billing/billing.schema.ts` and `billing.service.ts`: replace nullable Free-credit-only metadata with one recap allowance DTO.
- Modify `src/modules/ai/ai.routes.ts` and `ai.service.ts`: resolve entitlement server-side, reserve after cache lookup, settle after save, and return a safe depleted-allowance `429`.
- Modify `src/modules/workspace/workspaces.repository.ts` and `workspace.service.ts`: map capacity RPC errors and block a capacity-full invitation before attempting delivery.
- Modify `src/modules/auth/auth.service.ts`: map atomic invitation acceptance capacity errors to the same public `409` response.
- Modify focused tests: `tests/premium-assistant.migration.test.ts`, `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`, `tests/subscriptions.service.test.ts`, `tests/workspace.service.test.ts`, `tests/workspace.repository.test.ts`, `tests/auth.service.test.ts`, and `tests/api-contract.routes.test.ts`.
- Regenerate `docs/openapi.json`.

### Mobile client (`D:/Projects/myself/weekly-us`)

- Modify `src/shared/api/subscriptionsApi.ts`, `src/features/subscription/types.ts`, `src/features/subscription/services/backendSubscriptionProvider.ts`, and `src/app/stores/subscription.ts`: retain the authoritative recap allowance in the subscription snapshot.
- Modify `src/pages/MeetingSummaryPage.vue` and `src/features/meeting/aiSummaryService.ts`: render localized remaining-recap copy, refresh the snapshot after successful generation, and handle allowance exhaustion.
- Modify `src/app/stores/workspace.ts`, `src/features/participants/participantInvitationEligibility.ts`, and `src/features/participants/components/HouseholdMembersSettings.vue`: calculate the visible capacity from the trusted plan and active members, block the invite action locally, and map backend limit errors.
- Modify `src/features/localization/messages.ts` for English, Ukrainian, and Spanish copy.
- Modify or create focused tests in `src/features/meeting/__tests__/aiSummaryService.test.ts`, `src/features/subscription/services/__tests__/subscriptionService.test.ts`, `src/app/stores/__tests__/workspace.test.ts`, `src/features/participants/__tests__/participantInvitationEligibility.test.ts`, and a component test beside `HouseholdMembersSettings.vue` if none exists.

## Task 1: Add a backward-compatible database allowance and member-cap contract

**Files:**
- Create: `supabase/migrations/20260829120000_add_recap_allowances_and_member_caps.sql`
- Modify: `tests/premium-assistant.migration.test.ts`
- Modify: `tests/participant-email-access.migration.test.ts`

**Interfaces:**
- Produces `assistant_recap_credit_reservations.allowance_period_ends_at timestamptz null`.
- Produces `reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer) returns boolean`; `NULL` period means the lifetime Free allowance.
- Produces `household_member_limit_reached` database exceptions with JSON `{ "limit": number, "currentCount": number }` in `DETAIL`.

- [ ] **Step 1: Write structural migration assertions**

```ts
const sql = await readFile(
  'supabase/migrations/20260829120000_add_recap_allowances_and_member_caps.sql',
  'utf8',
);

expect(sql).toContain('add column allowance_period_ends_at timestamptz');
expect(sql).toContain('reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer)');
expect(sql).toContain("raise exception using message = 'household_member_limit_reached'");
expect(sql).toContain('pg_advisory_xact_lock');
expect(sql).toContain('status = \'active\'');
```

- [ ] **Step 2: Run the structural tests and verify failure**

Run: `npm test -- tests/premium-assistant.migration.test.ts tests/participant-email-access.migration.test.ts`

Expected: FAIL because migration `20260829120000_add_recap_allowances_and_member_caps.sql` is absent.

- [ ] **Step 3: Write the additive migration**

Add the nullable period-end column and an index that supports a workspace, period, state count. Preserve historical rows as `NULL` Free credits. Add a four-argument reservation overload; it must lock by workspace, release stale `reserved` rows older than 15 minutes only inside the same allowance period, count `reserved` plus `settled`, and insert the requested period only if the count is below `p_limit`.

```sql
alter table public.assistant_recap_credit_reservations
  add column allowance_period_ends_at timestamptz;

create index assistant_recap_credit_reservations_allowance_idx
  on public.assistant_recap_credit_reservations
    (workspace_id, allowance_period_ends_at, state, reserved_at);
```

Replace `create_participant_invitation` and `accept_participant_invitation` with new definitions that: lock the workspace with `pg_advisory_xact_lock`, compute effective Premium from `subscriptions` using `plan_type = 'premium'`, an active/trial/grace status, and a non-expired `expires_at`, count only active `workspace_members`, and use `8` or `4` as the limit. At acceptance, count after locking the invitation and before upserting the membership. Do not count a member already active for the same user as a new slot. On overflow, raise:

```sql
raise exception using
  message = 'household_member_limit_reached',
  detail = json_build_object('limit', v_limit, 'currentCount', v_current_count)::text;
```

Revoke public, anonymous, and authenticated access to the new reservation overload and grant only `service_role` execute. Preserve existing grants on invitation RPCs and all existing invitation validation/role checks.

- [ ] **Step 4: Run structural tests and local migration dry run**

Run: `npm test -- tests/premium-assistant.migration.test.ts tests/participant-email-access.migration.test.ts`

Run: `npm run db:migrate:local:dry-run`

Expected: tests PASS; local dry run reports the new migration without modifying a shared environment.

- [ ] **Step 5: Checkpoint**

Review that the migration only adds a nullable column, index, and replacement RPC definitions; it must not remove members, invitations, or prior credits.

## Task 2: Centralize plan limits and expose one recap-allowance status DTO

**Files:**
- Create: `src/modules/billing/plan-limits.ts`
- Modify: `src/modules/assistant/assistant.repository.ts`
- Modify: `src/modules/billing/billing.schema.ts`
- Modify: `src/modules/billing/billing.service.ts`
- Modify: `tests/subscriptions.service.test.ts`

**Interfaces:**
- Produces `FREE_RECAP_LIMIT = 3`, `PREMIUM_RECAP_LIMIT = 20`, `FREE_HOUSEHOLD_MEMBER_LIMIT = 4`, and `PREMIUM_HOUSEHOLD_MEMBER_LIMIT = 8`.
- Produces `resolveRecapAllowance(planType, expiresAt, used, role)` returning `{ limit, used, remaining, periodEndsAt, canGenerate }`.
- Produces `assistantRecap` on `SubscriptionStatusDto` with the exact non-null fields `{ limit, used, remaining, periodEndsAt, canGenerate }`.

- [ ] **Step 1: Write failing subscription tests**

```ts
expect(freeStatus.assistantRecap).toEqual({
  limit: 3,
  used: 1,
  remaining: 2,
  periodEndsAt: null,
  canGenerate: true,
});

expect(premiumStatus.assistantRecap).toEqual({
  limit: 20,
  used: 8,
  remaining: 12,
  periodEndsAt: future,
  canGenerate: true,
});

expect(viewerStatus.assistantRecap.canGenerate).toBe(false);
```

- [ ] **Step 2: Run the focused subscription test**

Run: `npm test -- tests/subscriptions.service.test.ts`

Expected: FAIL because the current DTO exposes `remainingFreeCredits` and Premium has no usage count.

- [ ] **Step 3: Implement limits, repository reads, and DTO derivation**

In `plan-limits.ts`, make the plan-limit helpers pure and clamp `remaining` to zero. In `AssistantRepository`, replace the Free-specific count with `countUsedRecaps(workspaceId, periodEndsAt)` that filters `state in ('reserved', 'settled')` and uses `.is('allowance_period_ends_at', null)` for Free or `.eq('allowance_period_ends_at', periodEndsAt)` for Premium. Add typed `reserveRecap`, `settleRecap`, and `releaseRecap` RPC wrappers.

In `billing.schema.ts`, use:

```ts
export const assistantRecapSchema = z.object({
  limit: z.number().int().positive(),
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  periodEndsAt: nullableIsoDateTimeStringSchema,
  canGenerate: z.boolean(),
});
```

Have `SubscriptionService` obtain usage with the effective plan and trusted `expiresAt`, then construct the same DTO for cached, restored, and RevenueCat-synced statuses. Premium grace-period expiry is the active period end; a missing/expired record resolves to the Free lifetime period.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/subscriptions.service.test.ts`

Expected: PASS for Free, Premium, viewer, grace-period, and expired-entitlement DTOs.

- [ ] **Step 5: Checkpoint**

Confirm no client-visible status uses `null` as an implicit “unlimited” value and no repository query omits `workspace_id`.

## Task 3: Make recap generation allowance-aware and failure-safe

**Files:**
- Modify: `src/modules/ai/ai.routes.ts`
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `tests/ai.service.test.ts`
- Modify: `tests/ai.routes.test.ts`

**Interfaces:**
- `AiSummaryService` receives an entitlement/allowance port that resolves the workspace’s trusted current plan and reserve/settle/release operations.
- A depleted allowance returns `ApiError(429, 'recap_allowance_exhausted', 'No AI recaps are available right now.', { limit, used, remaining: 0, resetAt })`.
- Per-hour anti-abuse limits become `3` per user and `8` per workspace; only new provider generations reach this check.

- [ ] **Step 1: Add failing service and route cases**

```ts
await expect(service.generateMeetingSummary(freeAdult, request)).resolves.toMatchObject({
  summary: expect.any(Object),
});
expect(allowances.reserveRecap).toHaveBeenCalledWith(
  'workspace-1', expect.any(String), null, 3,
);
expect(allowances.settleRecap).toHaveBeenCalledOnce();

await expect(service.generateMeetingSummary(depletedPremiumAdult, request)).rejects.toMatchObject({
  statusCode: 429,
  code: 'recap_allowance_exhausted',
  details: { limit: 20, used: 20, remaining: 0, resetAt: future },
});
expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
```

Also add cache-hit, failed-provider, invalid-provider-output, and failed-summary-save cases proving no extra settled credit; add route coverage that a Free adult reaches the service while a viewer is still rejected.

- [ ] **Step 2: Run focused AI tests**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts`

Expected: FAIL because `requireFeature(..., 'aiSummary')` rejects Free users and the service neither reserves nor settles allowance entries.

- [ ] **Step 3: Implement the safe generation ordering**

Remove only the route-level `aiSummary` feature pre-handler; keep authentication. In the service, move cache lookup before the hourly rate check. After a cache miss, resolve the trusted allowance, reject a role-ineligible or depleted request, create the pending AI request, reserve one allowance entry, re-check the new-generation hourly cap, call the provider, validate and save the recap, then settle the reservation.

```ts
cache hit
  -> return saved summary without rate or allowance mutation
cache miss
  -> resolve allowance -> create request -> reserve
  -> hourly guard -> provider -> validate -> save -> settle
```

On every thrown path after a successful reservation, release the reservation before marking the AI request failed and rethrowing its safe error. Lower `AI_RATE_LIMIT_PER_USER` to `3` and `AI_RATE_LIMIT_PER_WORKSPACE` to `8`. Pass the new allowance port from `createDefaultAiSummaryService` using the existing Supabase client and the subscription repository.

- [ ] **Step 4: Run focused and contract tests**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts tests/subscriptions.service.test.ts`

Expected: PASS; Free receives three lifetime successful generations, Premium receives 20 per exact period end, and cache reads do not consume allowance or hourly capacity.

- [ ] **Step 5: Checkpoint**

Inspect structured logs: retain workspace, meeting, request IDs and allowance state only; never log notes, prompts, tokens, or invitation data.

## Task 4: Enforce household member capacity across invitation flows

**Files:**
- Modify: `src/modules/workspace/workspaces.repository.ts`
- Modify: `src/modules/workspace/workspace.service.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `tests/workspace.service.test.ts`
- Modify: `tests/workspace.repository.test.ts`
- Modify: `tests/auth.service.test.ts`
- Modify: `tests/api-contract.routes.test.ts`

**Interfaces:**
- Maps database `household_member_limit_reached` to `ApiError(409, 'household_member_limit_reached', 'This household has reached its member limit.', { limit, currentCount })`.
- `WorkspaceService.createInvitation` checks capacity before issuing/sending a token; `accept_participant_invitation` remains the final atomic capacity guard.

- [ ] **Step 1: Add failing member-cap tests**

```ts
await expect(service.createInvitation(freeOwner, invitationInput)).rejects.toMatchObject({
  statusCode: 409,
  code: 'household_member_limit_reached',
  details: { limit: 4, currentCount: 4 },
});
expect(sendInvitationEmail).not.toHaveBeenCalled();

await expect(authService.acceptWorkspaceInvitation(supabase, auth, { token })).rejects.toMatchObject({
  statusCode: 409,
  code: 'household_member_limit_reached',
  details: { limit: 8, currentCount: 8 },
});
```

Cover Premium capacity at 7/8/9, Free at 3/4/5, pending invitations not increasing the count, an expired Premium household with six members rejecting the next acceptance, and a previously active same user not taking an extra slot.

- [ ] **Step 2: Run focused member tests**

Run: `npm test -- tests/workspace.service.test.ts tests/workspace.repository.test.ts tests/auth.service.test.ts tests/api-contract.routes.test.ts`

Expected: FAIL because capacity is not calculated and the database errors are not mapped.

- [ ] **Step 3: Implement backend capacity mapping and preflight**

Add `countActiveMembersForWorkspace(workspaceId)` to `WorkspacesRepository`. Add a trusted-plan lookup dependency to `WorkspaceService` (use the existing `SubscriptionsRepository` and `resolveEffectivePlan`, not the client-provided `auth.planType`), calculate four/eight through `plan-limits.ts`, and reject before `issueInvitationToken()` when count is at capacity.

Extend `mapInvitationRpcError` and the auth invitation-error mapper to parse the PostgreSQL `DETAIL` JSON safely:

```ts
const details = JSON.parse(error.details ?? '{}') as {
  limit?: number;
  currentCount?: number;
};
throw new ApiError(409, 'household_member_limit_reached',
  'This household has reached its member limit.', {
    limit: details.limit,
    currentCount: details.currentCount,
  },
);
```

If the detail is malformed, return the same code/message with `{}` rather than leaking a database failure. Register `409` in every affected route’s response schema, preserving all existing invitation and membership authorization behavior.

- [ ] **Step 4: Run focused member tests**

Run: `npm test -- tests/workspace.service.test.ts tests/workspace.repository.test.ts tests/auth.service.test.ts tests/api-contract.routes.test.ts`

Expected: PASS, including the stale-invitation acceptance race protection supplied by the SQL RPC.

- [ ] **Step 5: Checkpoint**

Review downgrade behavior: no code path changes an existing member’s status because of a plan change.

## Task 5: Map allowance and capacity state into the mobile app

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/subscriptionsApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/services/backendSubscriptionProvider.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/subscription.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/aiSummaryService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingSummaryPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/workspace.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/participants/participantInvitationEligibility.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Test: `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiSummaryService.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/features/subscription/services/__tests__/subscriptionService.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/workspace.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/features/participants/__tests__/participantInvitationEligibility.test.ts`

**Interfaces:**
- `SubscriptionSnapshot` gains `assistantRecap: { limit: number; used: number; remaining: number; periodEndsAt: string | null; canGenerate: boolean } | null`.
- The meeting recap page receives a formatted string from the snapshot; it never derives a quota from Premium feature access alone.
- Member invitation eligibility receives `memberLimit` and `activeMemberCount` in addition to role/access data.

- [ ] **Step 1: Add failing mobile tests**

```ts
expect(snapshot.assistantRecap).toEqual({
  limit: 20,
  used: 8,
  remaining: 12,
  periodEndsAt: '2026-09-29T10:00:00.000Z',
  canGenerate: true,
});

expect(canOfferParticipantInvitation({
  ...eligibleInput,
  activeMemberCount: 4,
  memberLimit: 4,
})).toBe(false);
```

Add page/component assertions for `2 free recaps left`, a locale-formatted Premium `12 of 20 recaps available until 29 September`, a zero-credit owner upgrade state, a viewer non-actionable state, and a Free household `4 of 4 members` invitation state.

- [ ] **Step 2: Run focused mobile tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting/__tests__/aiSummaryService.test.ts src/features/subscription/services/__tests__/subscriptionService.test.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts`

Expected: FAIL because the API DTO is discarded and invitation eligibility has no capacity inputs.

- [ ] **Step 3: Implement API mapping, presentation, and error handling**

Add the assistant allowance DTO to `SubscriptionStatusDto`, map it into `SubscriptionSnapshot`, and clear it to `null` only for an old backend response that omits the additive field. Add a subscription-store getter that returns this snapshot field without inferring allowance from `aiSummary` feature state.

In `MeetingSummaryPage.vue`, show the recap status adjacent to the generation control using these translation parameters:

```ts
t('meeting.aiSummary.freeAllowance', { remaining })
t('meeting.aiSummary.premiumAllowance', { remaining, limit, until })
```

Format `periodEndsAt` with `Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })`. After a successful non-cached generate operation, call `subscriptionStore.refreshCurrentPlan()` so the number updates. On `recap_allowance_exhausted`, refresh once, show the new allowance status, and use the owner-only Premium prompt for depleted Free status; do not show a payment CTA to a viewer.

For members, compute `memberLimit` from `subscriptionStore.currentPlan` (`4` Free, `8` Premium) and `activeMemberCount` from `workspaceStore.activeMembers.length`. Display `{count} of {limit} members` near the invite action. Pass both to `canOfferParticipantInvitation`; when full, disable the action and show owner/non-owner localized copy. In the workspace store, recognize `ApiClientError` code `household_member_limit_reached`, refresh the workspace and subscription snapshots, and retain the server message rather than converting it to the generic invitation failure.

Add calm English, Ukrainian, and Spanish strings for recap allowance, period-end wording, capacity count, Free upgrade opportunity, and non-owner capacity notice.

- [ ] **Step 4: Run focused mobile tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting/__tests__/aiSummaryService.test.ts src/features/subscription/services/__tests__/subscriptionService.test.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts`

Expected: PASS; status text is localized, errors preserve safe backend wording, and UI capacity never promises a ninth/eighth member.

- [ ] **Step 5: Checkpoint**

Manually inspect the mobile settings sheet and recap page at a narrow phone viewport; status copy must remain compact and the disabled invite action must still explain why.

## Task 6: Regenerate API contract and verify both applications

**Files:**
- Modify: `docs/openapi.json`
- Verify: all files from Tasks 1–5

- [ ] **Step 1: Regenerate OpenAPI after backend schemas/routes are final**

Run from `D:/Projects/myself/weekly-us-api`: `npm run openapi:generate`

Expected: `docs/openapi.json` includes `assistantRecap.limit`, `used`, `remaining`, and `periodEndsAt`, plus the `409` invitation error response.

- [ ] **Step 2: Run backend release checks**

Run from `D:/Projects/myself/weekly-us-api`:

```powershell
npm run typecheck
npm test
npm run openapi:check
npm run build
```

Expected: all commands PASS. If a local Supabase instance is available, also run `npm run db:migrate:local` and execute concurrent Free/Premium reservation and invitation-acceptance checks against it before any shared deployment.

- [ ] **Step 3: Run mobile release checks**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test
npm run build
npm run check
```

Expected: all commands PASS.

- [ ] **Step 4: Review scope and hand off**

Inspect diffs in both repositories. Confirm only the new migration, recap/member limit logic, affected tests, localization, the generated OpenAPI document, and the approved design/plan documents changed. Do not stage or commit.
