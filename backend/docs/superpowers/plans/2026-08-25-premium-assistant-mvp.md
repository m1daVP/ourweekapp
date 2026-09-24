# Premium Assistant MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every Free household try three successful AI recaps, then deliver Premium Smart Follow-ups through a durable shared inbox and device-local notifications.

**Architecture:** Additive Supabase schema and RPCs provide race-safe credit reservations and workspace-scoped follow-up state. The Fastify API owns entitlement decisions and the PGMQ worker creates follow-ups idempotently; the Vue/Capacitor client displays the authoritative inbox and schedules local alerts without introducing remote push infrastructure.

**Tech Stack:** Node.js, Fastify, TypeScript, Zod, Supabase/PostgreSQL, PGMQ, Vitest; Vue 3, Pinia, Vue Router, vue-i18n, Capacitor Local Notifications.

## Global Constraints

- Free workspaces receive exactly **3 lifetime, workspace-scoped** AI recap credits; only successful, non-cached summaries settle a credit.
- Premium household subscriptions provide unlimited recaps and Smart Follow-ups; purchase management remains owner-only.
- `agreementReminders` stays the existing Free local-reminder feature. Add a distinct Premium `smartFollowUps` feature.
- Smart Follow-ups are readable after Premium expiry; only `done` remains actionable after expiry. Do not create, snooze, or carry forward new automation while expired.
- Follow-up delivery is device-local and best effort. Never introduce FCM/APNs, device tokens, a push provider, or email delivery.
- Every new workspace-owned database access filters `workspace_id`; service-role use does not replace service authorization.
- Preserve historical meetings, tasks, agreements, and saved AI summaries. Do not edit applied migrations.
- Do not add dependencies. Keep user-facing mobile copy calm and translation-ready.
- Do not stage or commit changes without the repository owner’s explicit approval.

---

## File Map

### API and database

- Create `supabase/migrations/20260825120000_create_premium_assistant_schema.sql`: assistant settings, recap-credit reservations, follow-ups, additive agreement responsibility metadata, indexes, RLS, and service-role-only RPCs.
- Create `src/modules/assistant/assistant.schema.ts`: Zod DTOs for settings, inbox, actions, review, and recap entitlement.
- Create `src/modules/assistant/assistant.repository.ts`: workspace-scoped data access plus typed credit-RPC calls.
- Create `src/modules/assistant/assistant.service.ts`: authorization, cadence calculations, action transitions, review queries, and follow-up evaluation.
- Create `src/modules/assistant/assistant.routes.ts`: authenticated Fastify routes.
- Create `src/modules/assistant/assistant.jobs.ts`: typed worker job constructor and idempotent evaluation handler.
- Create `src/modules/assistant/index.ts`: public module exports.
- Modify `src/modules/billing/feature-access.ts`, `billing.schema.ts`, and `billing.service.ts`: expose `smartFollowUps` and derived recap-credit status.
- Modify `src/modules/ai/ai.routes.ts`, `ai.service.ts`, and `ai.repository.ts`: replace the route-level Premium-only gate with service-owned credit reservation/settlement.
- Modify `src/modules/tasks/tasks.schema.ts`, `tasks.repository.ts`, and `tasks.service.ts`: carry nullable `responsibleUserId` for agreements and validate it against active workspace adults.
- Modify `src/routes/v1.routes.ts` and `src/worker.ts`: register assistant HTTP routes and the worker handler.
- Modify `docs/openapi.json`: generated API contract after route/schema changes.

### API tests

- Create `tests/premium-assistant.migration.test.ts`.
- Create `tests/assistant.service.test.ts` and `tests/assistant.routes.test.ts`.
- Create `tests/assistant.jobs.test.ts`.
- Modify `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`, `tests/feature-access.test.ts`, `tests/subscriptions.service.test.ts`, and `tests/tasks.service.test.ts`.

### Mobile client (`D:/Projects/myself/weekly-us`)

- Create `src/features/assistant/types.ts`, `services/assistantService.ts`, and tests for service/store behavior.
- Create `src/shared/api/assistantApi.ts` and `src/app/stores/assistant.ts`.
- Create `src/pages/FollowUpsPage.vue` and a focused follow-up action component if the page needs splitting.
- Modify `src/features/access/types.ts`, `featureAccess.config.ts`, and `legacyFeatureAccess.ts` for `smartFollowUps`.
- Modify `src/features/subscription/types.ts`, `services/backendSubscriptionProvider.ts`, and `src/app/stores/subscription.ts` to retain recap-credit availability.
- Modify `src/features/meeting/aiSummaryService.ts`, `src/pages/MeetingDetailsPage.vue`, and `src/pages/MeetingSummaryPage.vue` to display the remaining Free credits and the depleted-credit upgrade state.
- Modify `src/features/tasks/types.ts`, `src/app/stores/tasks.ts`, `src/shared/api/syncDtos.ts`, and `src/shared/api/tasksApi.ts` for nullable agreement `responsibleUserId`.
- Modify `src/features/meeting/types.ts`, `composables/useMeetingSession.ts`, and `components/MeetingSectionStep.vue` to choose an optional active adult member when creating an agreement.
- Modify `src/features/reminders/reminderService.ts`, `src/shared/composables/useNotifications.ts`, and `src/app/App.vue` to synchronize an isolated Smart Follow-up local-notification channel.
- Modify `src/features/meeting/components/MeetingReviewCloseStep.vue`, `src/pages/MeetingPage.vue`, and `src/app/router/index.ts` to show the inbox/review flow.
- Modify `src/features/localization/messages.ts` and applicable unit/component tests.

## Task 1: Add the durable Premium Assistant database contract

**Files:**
- Create: `supabase/migrations/20260825120000_create_premium_assistant_schema.sql`
- Create: `tests/premium-assistant.migration.test.ts`

**Interfaces:**
- Produces `assistant_settings`, `assistant_recap_credit_reservations`, and `assistant_follow_ups` tables.
- Produces `reserve_assistant_recap_credit`, `settle_assistant_recap_credit`, and `release_assistant_recap_credit` service-role-only RPCs.
- Produces nullable `agreements.responsible_user_id uuid` referencing an active workspace member at service level.

- [ ] **Step 1: Write structural migration tests**

```ts
expect(sql).toContain('create table public.assistant_follow_ups');
expect(sql).toContain("check (state in ('open', 'resolved', 'snoozed', 'carry_to_next_meeting'))");
expect(sql).toContain('create unique index assistant_follow_ups_active_source_unique_idx');
expect(sql).toContain('create or replace function public.reserve_assistant_recap_credit');
expect(sql).toContain('grant execute on function public.reserve_assistant_recap_credit(uuid, uuid) to service_role');
expect(sql).toContain('alter table public.assistant_follow_ups enable row level security');
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run: `npm test -- tests/premium-assistant.migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the additive migration**

Implement the following database shape:

```sql
create table public.assistant_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  weekly_meeting_weekday smallint check (weekly_meeting_weekday between 0 and 6),
  weekly_meeting_local_time time,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((weekly_meeting_weekday is null and weekly_meeting_local_time is null and timezone is null)
    or (weekly_meeting_weekday is not null and weekly_meeting_local_time is not null and timezone is not null))
);

create table public.assistant_recap_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_summary_request_id uuid not null unique references public.ai_summary_requests(id) on delete cascade,
  state text not null check (state in ('reserved', 'settled', 'released')),
  reserved_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz
);
```

Use a `15 minute` stale-reservation cutoff inside `reserve_assistant_recap_credit`, release stale reservations before counting `reserved`/`settled` rows, and return `false` once the count reaches `3`. Add a `assistant_follow_ups` source uniqueness rule that prevents more than one non-resolved record for `(workspace_id, source_type, source_id)`. Add `workspace_id` indexes for inbox ordering and source lookup, enable deny-all RLS on new tables, grant only service role to the RPCs, and alter `agreements` with the nullable responsibility column plus a `(workspace_id, responsible_user_id)` foreign key to `workspace_members`.

- [ ] **Step 4: Run the migration test and inspect SQL locally**

Run: `npm test -- tests/premium-assistant.migration.test.ts`

Expected: PASS. If local Supabase is available, apply this migration there before proceeding; do not run it against shared environments.

- [ ] **Step 5: Checkpoint**

Review migration lock/rollback impact. Do not stage or commit without explicit approval.

## Task 2: Define access contract and assistant data layer

**Files:**
- Create: `src/modules/assistant/assistant.schema.ts`
- Create: `src/modules/assistant/assistant.repository.ts`
- Create: `src/modules/assistant/index.ts`
- Modify: `src/modules/billing/feature-access.ts`
- Modify: `src/modules/billing/billing.schema.ts`
- Modify: `src/modules/billing/billing.service.ts`
- Test: `tests/feature-access.test.ts`, `tests/subscriptions.service.test.ts`

**Interfaces:**
- Produces `smartFollowUps` as an adult-only, Premium, server-enforced feature.
- Produces `assistantRecapAccessSchema` as `{ remainingFreeCredits: z.number().int().min(0).max(3).nullable(), canGenerate: z.boolean() }` on subscription status.
- Produces repository methods `getRemainingFreeRecapCredits(workspaceId)`, `reserveRecapCredit(workspaceId, requestId)`, `settleRecapCredit(workspaceId, requestId)`, and `releaseRecapCredit(workspaceId, requestId)`.

- [ ] **Step 1: Add failing entitlement tests**

```ts
expect(featureCatalog.smartFollowUps).toMatchObject({
  tier: 'premium', lifecycle: 'available', eligibleRoles: ['owner', 'adult_member'], enforcement: 'server',
});
expect(freeStatus.assistantRecap).toEqual({ remainingFreeCredits: 3, canGenerate: true });
expect(premiumStatus.assistantRecap.remainingFreeCredits).toBeNull();
```

- [ ] **Step 2: Run focused entitlement tests**

Run: `npm test -- tests/feature-access.test.ts tests/subscriptions.service.test.ts`

Expected: FAIL because `smartFollowUps` and `assistantRecap` are absent.

- [ ] **Step 3: Implement schemas, repository mapping, and status derivation**

Add `smartFollowUps` to `subscriptionFeatureKeys`, `featureCatalog`, Free/Premium feature lists, and Zod status schemas. Construct `assistantRecap` from trusted plan state and the reservation repository:

```ts
const assistantRecap = planType === 'premium'
  ? { remainingFreeCredits: null, canGenerate: role !== 'viewer' }
  : { remainingFreeCredits, canGenerate: role !== 'viewer' && remainingFreeCredits > 0 };
```

Use explicit column lists and `.eq('workspace_id', workspaceId)` in every repository query. Keep the status response backward compatible by adding this object rather than altering existing fields.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/feature-access.test.ts tests/subscriptions.service.test.ts`

Expected: PASS, including viewer role restriction and a Premium null credit balance.

- [ ] **Step 5: Checkpoint**

Review the API DTO for secret-free, stable camelCase fields. Do not stage or commit without explicit approval.

## Task 3: Make AI recap credits service-owned and failure-safe

**Files:**
- Modify: `src/modules/ai/ai.routes.ts`
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `src/modules/ai/ai.repository.ts`
- Test: `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`

**Interfaces:**
- Consumes the credit repository methods from Task 2.
- Produces the existing recap response unchanged and preserves `premium_required` when Free credits are depleted.

- [ ] **Step 1: Write failing AI service tests**

```ts
await expect(service.generateMeetingSummary(freeAdult, request)).resolves.toMatchObject({ summary: expect.any(Object) });
expect(credits.reserveRecapCredit).toHaveBeenCalledWith(freeAdult.workspaceId, requestRow.id);
expect(credits.settleRecapCredit).toHaveBeenCalledWith(freeAdult.workspaceId, requestRow.id);

await expect(service.generateMeetingSummary(freeAdult, request)).rejects.toMatchObject({
  code: 'premium_required', statusCode: 403,
});
expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
```

Add separate tests proving cache hits do not reserve, provider/validation/save failures release, Premium does not reserve, and viewers are rejected.

- [ ] **Step 2: Run AI tests and verify the expected failure**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts`

Expected: FAIL because the route's `requireFeature(..., 'aiSummary')` rejects Free users before the service can evaluate credits.

- [ ] **Step 3: Move authorization into `AiSummaryService`**

Remove only the `aiSummary` route-level `requireFeature` pre-handler; retain authentication and rate limiting. After cache lookup and rate-limit checks, create the AI request, reserve a Free credit when the workspace lacks trusted Premium, and settle only after `updateMeetingSummary` succeeds. On every catch path after reservation, call release before rethrowing the existing safe error.

The ordering must be:

```ts
cached summary -> rate limit -> create request -> reserve if Free -> provider -> validate -> save summary -> settle
```

If reservation returns false, mark the request failed with `premium_required` and throw the existing `ApiError(403, 'premium_required', ...)` without invoking the provider.

- [ ] **Step 4: Run focused API tests**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts tests/subscriptions.service.test.ts`

Expected: PASS; existing Premium behavior remains unchanged and Free has exactly three successful new summaries.

- [ ] **Step 5: Checkpoint**

Review logs to ensure they retain only request/workspace/meeting IDs and error codes. Do not stage or commit without explicit approval.

## Task 4: Carry optional responsible adult IDs through agreement sync

**Files:**
- Modify: `src/modules/tasks/tasks.schema.ts`
- Modify: `src/modules/tasks/tasks.repository.ts`
- Modify: `src/modules/tasks/tasks.service.ts`
- Test: `tests/tasks.service.test.ts`

**Interfaces:**
- Adds optional `AgreementDto.responsibleUserId?: string`.
- Validates responsibility against an active workspace member whose role is `owner` or `adult_member`.
- Keeps older clients valid by accepting an omitted field and persisting `NULL`.

- [ ] **Step 1: Add failing task sync tests**

```ts
await service.syncTasks(adultAuth, withAgreement({ responsibleUserId: activeAdult.id }));
expect(repository.insertAgreement).toHaveBeenCalledWith(expect.objectContaining({
  responsibleUserId: activeAdult.id,
}));

await expect(service.syncTasks(adultAuth, withAgreement({ responsibleUserId: viewer.id })))
  .resolves.toMatchObject({ conflicts: [expect.objectContaining({ reason: 'invalid_reference' })] });
```

- [ ] **Step 2: Run task service tests**

Run: `npm test -- tests/tasks.service.test.ts`

Expected: FAIL because agreement DTOs and repositories do not carry the field.

- [ ] **Step 3: Implement backward-compatible DTO/repository/service support**

Extend agreement Zod schemas and explicit SQL column lists/mappers with `responsible_user_id`. Add a narrow workspace-members repository port to `TasksService` that lists active owner/adult IDs, and reject unknown, removed, or viewer IDs as an `invalid_reference` sync conflict. Include the nullable field in inserts, revision-match updates, comparison helpers, conflict snapshots, and API DTO mapping.

- [ ] **Step 4: Run focused regression tests**

Run: `npm test -- tests/tasks.service.test.ts tests/repository-mappers.test.ts`

Expected: PASS; legacy agreements without `responsibleUserId` still synchronize.

- [ ] **Step 5: Checkpoint**

Confirm participant IDs remain distinct from workspace user IDs. Do not stage or commit without explicit approval.

## Task 5: Implement assistant settings, inbox, and action services

**Files:**
- Create: `src/modules/assistant/assistant.service.ts`
- Create: `src/modules/assistant/assistant.routes.ts`
- Modify: `src/modules/assistant/assistant.schema.ts`
- Modify: `src/modules/assistant/assistant.repository.ts`
- Modify: `src/modules/assistant/index.ts`
- Modify: `src/routes/v1.routes.ts`
- Test: `tests/assistant.service.test.ts`, `tests/assistant.routes.test.ts`

**Interfaces:**
- `GET /v1/assistant/settings`, `PUT /v1/assistant/settings`
- `GET /v1/assistant/follow-ups?limit=20&offset=0`
- `POST /v1/assistant/follow-ups/:id/actions`
- `GET /v1/assistant/meeting-review?meetingId=:id`
- Action body: `{ action: 'done' | 'stillWorking' | 'discussAtNextMeeting' | 'snooze', snoozeUntil?: ISODateTime }`.

- [ ] **Step 1: Write failing service and route tests**

```ts
await expect(service.updateSettings(viewerAuth, settings)).rejects.toMatchObject({ code: 'feature_role_restricted' });
await expect(service.applyFollowUpAction(expiredAdult, followUpId, { action: 'snooze', snoozeUntil })).rejects
  .toMatchObject({ code: 'premium_required' });
await expect(service.applyFollowUpAction(expiredAdult, followUpId, { action: 'done' })).resolves.toMatchObject({ state: 'resolved' });
```

Add tests for pagination, workspace-scoped 404s, input validation, shared vs assigned visibility, and every action transition.

- [ ] **Step 2: Run assistant tests**

Run: `npm test -- tests/assistant.service.test.ts tests/assistant.routes.test.ts`

Expected: FAIL because the module and routes do not exist.

- [ ] **Step 3: Implement the assistant service contract**

Use Zod for weekday `0..6`, `HH:mm` local time, and an IANA timezone validated with `Intl.DateTimeFormat`. Require an adult role for every endpoint. Require `smartFollowUps` for settings writes and actions that create future automation; inbox list and meeting-review reads remain available to an adult after expiry, and `done` remains available for an existing accessible item after expiry. Apply transitions atomically:

```ts
done -> { state: 'resolved', actionedByUserId: auth.userId, actionedAt: now }
stillWorking | discussAtNextMeeting -> { state: 'carry_to_next_meeting', reviewAfterAt: nextMeetingStart }
snooze -> { state: 'snoozed', dueAt: snoozeUntil }
```

The review query returns unresolved agreement follow-ups whose source meeting completed before the requested meeting; it must include both `open` and `carry_to_next_meeting`, with an explicit `needsDiscussion` flag for carried records.

- [ ] **Step 4: Register and verify the route contract**

Register `assistantRoutes` at `/assistant`. Add 401/403/404/422/500 schemas to every public route. Run:

`npm test -- tests/assistant.service.test.ts tests/assistant.routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Inspect that every repository access uses `workspace_id` and all unexpected storage errors become safe `ApiError`s. Do not stage or commit without explicit approval.

## Task 6: Add idempotent follow-up evaluation to the worker

**Files:**
- Create: `src/modules/assistant/assistant.jobs.ts`
- Modify: `src/worker.ts`
- Test: `tests/assistant.jobs.test.ts`

**Interfaces:**
- Job envelope: `{ type: 'assistant.evaluate-follow-ups', version: 1, idempotencyKey: 'assistant-evaluate:<UTC-date>', payload: {} }`.
- `createAssistantFollowUpJobHandler(dependencies): JobHandler` creates/updates only eligible Premium-workspace records.

- [ ] **Step 1: Write failing worker-handler tests**

```ts
await handler(todayJob, { signal: new AbortController().signal });
expect(repository.upsertFollowUp).toHaveBeenCalledWith(expect.objectContaining({
  sourceType: 'agreement', dueAt: midpointIso,
}));

await handler(todayJob, context);
expect(repository.upsertFollowUp).toHaveBeenCalledTimes(1);
```

Cover the seven-day no-cadence fallback, overdue open task creation, completed/deleted/resolved exclusion, `stillWorking` suppression, and a retry with no duplicate source row.

- [ ] **Step 2: Run worker tests**

Run: `npm test -- tests/assistant.jobs.test.ts tests/background-jobs.worker.test.ts`

Expected: FAIL because the handler is not registered.

- [ ] **Step 3: Implement the sweep and handler**

Create one daily envelope with no source text in the payload. The handler enumerates eligible workspaces in bounded batches, skips workspaces without trusted Premium entitlement, loads only workspace-scoped candidates, and delegates date calculation/upsert behavior to `AssistantService`. Re-enqueue the following UTC daily sweep with a delay no greater than `86_400` seconds only after successful processing. Register the handler in `src/worker.ts`'s map.

- [ ] **Step 4: Run worker regressions**

Run: `npm test -- tests/assistant.jobs.test.ts tests/background-jobs.worker.test.ts tests/background-jobs.migration.test.ts`

Expected: PASS and dead-letter payloads remain metadata-only.

- [ ] **Step 5: Checkpoint**

Review initial deployment seeding: enqueue exactly one daily sweep through a controlled service-role operation after API/worker deployment, never from a client. Do not stage or commit without explicit approval.

## Task 7: Regenerate OpenAPI and verify the backend release unit

**Files:**
- Modify: `docs/openapi.json`
- Modify: `docs/deployment.md` only if worker deployment/seed instructions need a new Assistant job entry.

**Interfaces:**
- Documents the additive assistant endpoints, subscription `assistantRecap` object, and nullable agreement responsibility field.

- [ ] **Step 1: Add/adjust API contract assertions**

```ts
expect(openapi.paths['/v1/assistant/follow-ups']).toBeDefined();
expect(openapi.components.schemas.SubscriptionStatus.properties.assistantRecap).toBeDefined();
expect(openapi.components.schemas.Agreement.properties.responsibleUserId).toBeDefined();
```

- [ ] **Step 2: Run contract tests before generation**

Run: `npm test -- tests/api-contract.routes.test.ts`

Expected: FAIL until schemas/routes are registered.

- [ ] **Step 3: Generate and check the contract**

Run: `npm run openapi:generate` followed by `npm run openapi:check`

Expected: both commands PASS and `docs/openapi.json` includes the new endpoints.

- [ ] **Step 4: Run backend validation**

Run: `npm run typecheck` and `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts tests/assistant.service.test.ts tests/assistant.routes.test.ts tests/assistant.jobs.test.ts tests/tasks.service.test.ts tests/subscriptions.service.test.ts`

Expected: PASS. Do not change the known unrelated full-suite environment assertion or parallel-timeout flakes.

- [ ] **Step 5: Checkpoint**

Review API-before-client deployment order and migration/worker seeding instructions. Do not stage or commit without explicit approval.

## Task 8: Add client access and recap-credit presentation

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/access/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/access/featureAccess.config.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/access/legacyFeatureAccess.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/services/backendSubscriptionProvider.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/subscription.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/aiSummaryService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingDetailsPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingSummaryPage.vue`
- Test: client subscription-provider and AI-summary tests

**Interfaces:**
- Adds client `FeatureKey` `smartFollowUps`.
- Adds `SubscriptionSnapshot.assistantRecap: { remainingFreeCredits: number | null; canGenerate: boolean }`.
- Adds a typed client error parser for `premium_required` that distinguishes depleted recap credits from unrelated Premium requirements using the local snapshot.

- [ ] **Step 1: Write failing client tests**

```ts
expect(snapshot.assistantRecap).toEqual({ remainingFreeCredits: 2, canGenerate: true });
expect(createLegacyFeatureAccessMap({ planType: 'free' }).smartFollowUps.state).toBe('upgradeRequired');
```

Add page tests asserting a Free adult sees “2 free recaps remaining” before generation and an outcome-based upgrade prompt after depletion; a viewer must not see a generate action.

- [ ] **Step 2: Run client-focused tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/subscription src/features/meeting/__tests__/aiSummaryService.test.ts`

Expected: FAIL because the new snapshot field and feature key are absent.

- [ ] **Step 3: Implement snapshot normalization and recap UI**

Preserve backward-compatible fallback behavior when old APIs omit `assistantRecap`, defaulting Free to `{ remainingFreeCredits: 0, canGenerate: false }` to avoid showing a promise the API cannot honor. Replace each existing `canUseFeature('aiSummary')` visibility check with an assistant-recap predicate that allows a Free adult while `assistantRecap.canGenerate` is true and otherwise retains the existing Premium/role behavior. Add translation keys and compact helper copy near existing recap controls; use the existing owner-only purchase policy for the CTA.

- [ ] **Step 4: Run client tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/subscription src/features/meeting/__tests__/aiSummaryService.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Manually inspect the recap screen at a narrow mobile width; copy must say the household has credits and one plan covers the household. Do not stage or commit without explicit approval.

## Task 9: Build the client Smart Follow-ups inbox and isolated local alerts

**Files:**
- Create: `D:/Projects/myself/weekly-us/src/features/assistant/types.ts`
- Create: `D:/Projects/myself/weekly-us/src/features/assistant/services/assistantService.ts`
- Create: `D:/Projects/myself/weekly-us/src/shared/api/assistantApi.ts`
- Create: `D:/Projects/myself/weekly-us/src/app/stores/assistant.ts`
- Create: `D:/Projects/myself/weekly-us/src/pages/FollowUpsPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/reminders/reminderService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/composables/useNotifications.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/App.vue`
- Modify: `D:/Projects/myself/weekly-us/src/app/router/index.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/components/BottomNavigation.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Test: create assistant service/store/page tests and extend notification tests

**Interfaces:**
- `AssistantFollowUp` includes `id`, `sourceType`, `sourceId`, `title`, `state`, `dueAt`, `assignedToCurrentUser`, `shared`, and `needsDiscussion`.
- Store methods: `loadInbox()`, `applyAction(id, action)`, `loadMeetingReview(meetingId)`, and `clear()`.
- Notification functions: `scheduleAssistantFollowUpNotifications(items)` and `cancelAssistantFollowUpNotifications()` use separate channel/IDs.

- [ ] **Step 1: Write failing tests for inbox and notifications**

```ts
await assistantStore.loadInbox();
expect(assistantStore.openItems).toHaveLength(2);
await assistantStore.applyAction('follow-up-1', { action: 'done' });
expect(assistantStore.openItems).toHaveLength(1);

expect(LocalNotifications.schedule).toHaveBeenCalledWith(expect.objectContaining({
  notifications: expect.arrayContaining([expect.objectContaining({ channelId: 'ourweek-smart-follow-ups' })]),
}));
```

Add tests confirming the legacy `ourweek-reminders` notifications are never cancelled by assistant rescheduling, viewers see a role-restricted state, expiry keeps items readable but disables `snooze`/carry actions, and unassigned shared items schedule for adults.

- [ ] **Step 2: Run the new client tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/assistant src/shared/composables/__tests__/useNotifications.test.ts`

Expected: FAIL because the assistant feature/store/API do not exist.

- [ ] **Step 3: Implement API wrapper, Pinia state, mobile page, and local scheduling**

Use `apiRequest` with `requiresAuth: true` for all assistant endpoints. Render the calm prompt “How is this agreement going?” with large action buttons **Done**, **Still working on it**, and **Discuss at next meeting**. Present snooze through a mobile-friendly bottom sheet or concise form. On app startup and after authenticated sync, load the inbox, then schedule only future due items assigned to the current adult or shared with the household.

Keep notification IDs deterministic and distinct:

```ts
const ASSISTANT_CHANNEL_ID = 'ourweek-smart-follow-ups';
const assistantNotificationId = (followUpId: string) => stablePositiveInt(followUpId, 841_000);
```

- [ ] **Step 4: Add the route and navigation entry**

Register `/follow-ups` as an authenticated route without a `requiresFeature` meta gate, so an expired household can still read existing inbox content. The page itself must show a read-only expired state and use `smartFollowUps` access only to enable settings/actions that create future automation. Make the navigation entry compact and optional if the existing bottom navigation cannot accommodate it without crowding. If no tab is added, link prominently from Home and Settings instead.

- [ ] **Step 5: Run the client tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/assistant src/shared/composables/__tests__/useNotifications.test.ts`

Expected: PASS.

## Task 10: Integrate responsible-adult selection and next-meeting review

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/tasks/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/tasks.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/syncDtos.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/tasksApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/components/MeetingReviewCloseStep.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingPage.vue`
- Test: existing meeting-session/task-sync/review component tests plus new focused cases

**Interfaces:**
- Adds optional `responsibleUserId?: string` to local agreement types and sync DTOs.
- Agreement creation selects only active `owner`/`adult_member` workspace users from `useWorkspaceStore`; no selection means a shared inbox item.
- Meeting review consumes `assistantStore.loadMeetingReview(meeting.id)` and displays unresolved agreements from earlier meetings.

- [ ] **Step 1: Write failing UI/state tests**

```ts
session.setAgreementResponsibleUserId('adult-user-1');
session.addAgreement();
expect(meetingsStore.activeMeeting.sections[0].agreements[0].responsibleUserId).toBe('adult-user-1');

expect(wrapper.text()).toContain('How is this agreement going?');
expect(wrapper.text()).toContain('Discuss at next meeting');
```

Add a test that an empty selection creates a shared item and that viewer sessions cannot choose an assignee or alter review state.

- [ ] **Step 2: Run focused client tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/shared/api/__tests__/syncDtos.test.ts`

Expected: FAIL because agreements have no workspace-user responsibility and review has no assistant data.

- [ ] **Step 3: Implement agreement assignment and review rendering**

Thread the nullable `responsibleUserId` through local meeting agreement creation, task-store extraction, sync mapping, and conflict replacement without confusing it with `participantIds`. In the meeting UI, present a single optional “Who should check in?” selector using active adult members. In the next meeting review, load existing assistant records for an adult even after Premium expiry; show every unresolved agreement from an earlier meeting and visually emphasize `needsDiscussion` records, but do not offer future-automation actions when expired.

- [ ] **Step 4: Run focused regression tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/shared/api/__tests__/syncDtos.test.ts src/features/assistant`

Expected: PASS; existing participant-based agreement behavior remains intact.

- [ ] **Step 5: Checkpoint**

Manually test one shared agreement and one adult-assigned agreement on a narrow Android-sized viewport. Do not stage or commit without explicit approval.

## Task 11: Run release verification and staging checks

**Files:**
- Modify only generated/necessary documentation identified by prior tasks.

**Interfaces:**
- Produces verified API contract, client build, and a written staging result; no new runtime interfaces.

- [ ] **Step 1: Run backend checks**

Run from `D:/Projects/myself/weekly-us-api`:

```bash
npm run typecheck
npm run openapi:check
npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts tests/assistant.service.test.ts tests/assistant.routes.test.ts tests/assistant.jobs.test.ts tests/tasks.service.test.ts tests/subscriptions.service.test.ts tests/premium-assistant.migration.test.ts
```

Expected: PASS. Record the known unrelated full-suite environment assertion and parallel-timeout flakiness if a broader run is attempted.

- [ ] **Step 2: Run client checks**

Run from `D:/Projects/myself/weekly-us`:

```bash
npm test
npm run check
npm run build
```

Expected: PASS; note the pre-existing Vite native-config/large-chunk warnings if present.

- [ ] **Step 3: Perform staging manual checks after API then client deployment**

Verify all of the following:

- Free adult completes three new recaps, receives a cached recap without spending another credit, and is prompted to upgrade on the fourth new recap.
- Premium owner/adult has unlimited recaps; viewer cannot generate recaps or action Smart Follow-ups.
- An agreement with cadence becomes due at the computed midpoint; no-cadence agreement falls back to seven days.
- A shared agreement appears to all adults; an assigned agreement appears/schedules only for its responsible adult.
- Done stops alerts; Still working/Discuss appears in the next meeting review; expired Premium keeps inbox reading and Done but blocks future automation.
- Existing Free weekly/general reminder channel remains present and is not cancelled by assistant notification scheduling.

- [ ] **Step 4: Checkpoint**

Share verification results and any deployment/seed observations. Do not stage or commit without explicit approval.
