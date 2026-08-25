# Premium Entitlement Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated subscription feature decisions with an API-owned feature catalog and per-member access map, without changing the live Free/Premium boundary.

**Architecture:** The API billing module owns a static catalog and a pure resolver that combines lifecycle, role, and trusted workspace plan. `/v1/subscriptions/status` exposes every feature’s effective access; Fastify guards reuse the same resolver. The Vue client stores this access map and uses it for locks and routing, keeping local files only for localized presentation and a temporary old-response fallback.

**Tech Stack:** Node.js 24, Fastify 5, TypeScript 6, Zod 4, Vitest 4, Vue 3, Pinia 4, Vue Router 5, RevenueCat, Supabase.

## Global Constraints

- Preserve the existing live Free/Premium boundary: Free retains limited history and Premium retains unlimited history.
- Do not add trials, credits, pricing changes, RevenueCat product changes, new templates, smart follow-ups, search, reports, statistics, or backend private-note storage.
- The workspace subscription remains authoritative; only an active, recently verified Premium entitlement grants server-side Premium access.
- A planned feature is never purchasable or returned as available because the household has Premium.
- A member who lacks the required role receives a role restriction, never a Premium upgrade prompt.
- Keep response compatibility by retaining `enabledFeatures` until the mobile-client compatibility window is explicitly closed.
- Add no dependencies and make no database migration for this milestone.
- Do not stage, commit, rebase, reset, or push changes; commits require explicit user approval.
- Run `npm run typecheck && npm test && npm run openapi:check` in `weekly-us-api`, and `npm test && npm run build` in `weekly-us`, before handoff.

---

## File structure and responsibilities

### API repository — `D:\Projects\myself\weekly-us-api`

| File | Responsibility |
| --- | --- |
| Create `src/modules/billing/feature-access.ts` | Canonical feature catalog, Zod schemas, pure resolver, workspace entitlement lookup, and generic Fastify guards. |
| Modify `src/modules/billing/billing.schema.ts` | Add the additive `features` access map to the subscription DTO while retaining `enabledFeatures`. |
| Modify `src/modules/billing/billing.service.ts` | Produce catalog-derived feature access in `/subscriptions/status` and restore responses. |
| Delete `src/modules/billing/require-premium.middleware.ts` | Remove the duplicate generic Premium policy after every caller has migrated to the feature-specific guard. |
| Modify `src/modules/ai/ai.routes.ts`, `src/modules/calendar/calendar.routes.ts`, `src/modules/exports/exports.routes.ts` | Replace generic Premium checks with the feature-specific guard. |
| Modify `src/modules/meetings/meetings.service.ts` | Use the resolver for history, AI-summary persistence, and extra-template sync decisions. |
| Modify `src/modules/account/account.service.ts` | Produce schema-valid catalog access maps in account data export, using each membership’s role. |
| Create `tests/feature-access.test.ts` | Exhaustive catalog and pure resolver matrix. |
| Modify `tests/subscriptions.service.test.ts`, `tests/meetings.service.test.ts`, `tests/account.service.test.ts`, `tests/ai.routes.test.ts`, `tests/exports.routes.test.ts` | Assert status, service, export, and route behavior use the same contract. |
| Create `tests/calendar.routes.test.ts` | Add the missing route-level feature-gate contract coverage for Calendar endpoints. |

### Client repository — `D:\Projects\myself\weekly-us`

| File | Responsibility |
| --- | --- |
| Modify `src/features/access/types.ts` | Define API-compatible catalog lifecycle, tier, access-state, and access-map types. |
| Modify `src/features/access/featureAccess.config.ts` | Retain only localized/presentation metadata and the temporary history-copy limit; remove plan/role authority. |
| Modify `src/features/access/featureAccessPolicy.ts` | Resolve client display permission from the server access map, with a narrowly-scoped legacy fallback. |
| Modify `src/shared/api/subscriptionsApi.ts` | Type the additive `features` response field as optional for staged rollout. |
| Modify `src/features/subscription/types.ts`, `src/features/subscription/services/backendSubscriptionProvider.ts`, `src/features/subscription/services/revenueCatSubscriptionProvider.ts`, `src/app/stores/subscription.ts` | Carry the access map from API status into Pinia across browser and RevenueCat flows. |
| Modify `src/shared/composables/useFeatureAccess.ts`, `src/shared/composables/useNotifications.ts`, `src/app/router/index.ts` | Consume stored effective access instead of local plan membership. |
| Modify `src/shared/components/PremiumLock.vue`, `src/shared/components/UpgradePrompt.vue`, `src/pages/SettingsPage.vue` | Distinguish upgrade-required, role-restricted, and planned states without a misleading purchase CTA. |
| Modify `src/features/localization/messages.ts` | Add localized neutral copy for role restriction and planned/unavailable feature states in every supported locale. |
| Create `src/features/access/featureAccessPolicy.test.ts` and `src/app/stores/__tests__/subscription.test.ts` | Test server-map decisions and staged-response fallback. |
| Modify `src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`, `src/shared/composables/__tests__/useNotifications.test.ts` | Update subscription fixtures and prove Free reminder scheduling stays Free. |

## Task 1: Establish the canonical backend catalog and pure resolver

**Files:**
- Create: `D:\Projects\myself\weekly-us-api\src\modules\billing\feature-access.ts`
- Create: `D:\Projects\myself\weekly-us-api\tests\feature-access.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\billing\billing.schema.ts`

**Interfaces:**
- Consumes: `PlanType` and `UserRole` from `src/shared/auth`; migrates the existing stable feature-key list out of `billing.schema.ts`.
- Produces: `featureCatalog`, `SubscriptionFeatureKey`, `FeatureAccessState`, `FeatureAccessDto`, `resolveFeatureAccess`, and `resolveFeatureAccessMap` for billing services, guards, and the response schema.

- [ ] **Step 1: Write failing catalog and resolver tests**

```ts
import {
  featureCatalog,
  resolveFeatureAccess,
} from '../src/modules/billing/feature-access.js';

it('does not offer an upgrade for a planned Premium feature', () => {
  expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
    planType: 'free', role: 'owner',
  }).state).toBe('notYetAvailable');
});

it('prioritizes role restriction over Premium entitlement', () => {
  expect(resolveFeatureAccess(featureCatalog.aiSummary, {
    planType: 'free', role: 'viewer',
  }).state).toBe('roleRestricted');
});
```

Also cover: Free owner access to `agreementReminders`; Free adult `upgradeRequired` for `aiSummary`; Premium adult `available` for `aiSummary`; Premium viewer `roleRestricted` for Calendar and export; and unique catalog keys.

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npm test -- feature-access.test.ts` from `D:\Projects\myself\weekly-us-api`.

Expected: FAIL because `feature-access.ts` does not exist.

- [ ] **Step 3: Implement catalog types, schemas, and resolver**

Create the catalog as the only backend list of the existing keys. Use `available` lifecycle for every shipped key except `advancedStatistics`, which is `planned`. Mark `aiSummary`, `googleCalendarSync`, and `export` as adult-member-or-owner; all other shipped features allow all active workspace roles.

```ts
export const featureAccessStateSchema = z.enum([
  'available', 'upgradeRequired', 'roleRestricted',
  'notYetAvailable', 'unavailable',
]);

export function resolveFeatureAccess(
  feature: FeatureCatalogEntry,
  context: { planType: PlanType; role: UserRole },
): FeatureAccessDto {
  const state = feature.lifecycle !== 'available'
    ? feature.lifecycle === 'planned' ? 'notYetAvailable' : 'unavailable'
    : !feature.eligibleRoles.includes(context.role) ? 'roleRestricted'
    : feature.tier === 'premium' && context.planType !== 'premium'
      ? 'upgradeRequired' : 'available';

  return { key: feature.key, tier: feature.tier, lifecycle: feature.lifecycle,
    state, roleEligible: feature.eligibleRoles.includes(context.role),
    upgradeEligible: state === 'upgradeRequired' };
}
```

Make `feature-access.ts` the owner of the stable key list and `subscriptionFeatureSchema`; re-export the schema from `billing.schema.ts` so current imports continue to compile. Add `featureAccessDtoSchema` and a record schema covering all keys.

- [ ] **Step 4: Run resolver tests to verify they pass**

Run: `npm test -- feature-access.test.ts`.

Expected: PASS, including all lifecycle × role × plan assertions.

- [ ] **Step 5: Typecheck the API module boundary**

Run: `npm run typecheck`.

Expected: PASS; no `any` casts or duplicate feature-key union remains in billing code.

## Task 2: Return the effective map from subscription and account APIs

**Files:**
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\billing\billing.schema.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\billing\billing.service.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\account\account.service.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\subscriptions.service.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\account.service.test.ts`

**Interfaces:**
- Consumes: `resolveFeatureAccessMap({ planType, role })` from Task 1 and current RevenueCat trusted-plan behavior.
- Produces: `SubscriptionStatusDto.features: Record<SubscriptionFeatureKey, FeatureAccessDto>` while preserving `enabledFeatures` for legacy clients.

- [ ] **Step 1: Extend existing service tests with the additive response contract**

```ts
const status = await service.getStatus(adultAuth);

expect(status.enabledFeatures).toContain('agreementReminders');
expect(status.features.aiSummary).toMatchObject({
  tier: 'premium', lifecycle: 'available', state: 'upgradeRequired',
  upgradeEligible: true,
});
expect(status.features.advancedStatistics).toMatchObject({
  state: 'notYetAvailable', upgradeEligible: false,
});
```

Add a Premium viewer case showing `aiSummary`, Calendar, and export as `roleRestricted`. Update account-export fixtures to assert an access map is emitted for each exported workspace using that membership’s role.

- [ ] **Step 2: Run the billing and account tests to verify they fail**

Run: `npm test -- subscriptions.service.test.ts account.service.test.ts`.

Expected: FAIL because `features` is absent and Free `enabledFeatures` excludes `agreementReminders`.

- [ ] **Step 3: Add the map without changing plan resolution**

Extend `subscriptionStatusSchema` with a required `features` record, leave `enabledFeatures` in place, and change `subscriptionStatusFromRecord`/`freeStatus` to accept the authenticated role and call the Task 1 resolver after the current trusted plan is determined.

Preserve all existing RevenueCat refresh, grace period, and 24-hour trusted-cache logic. Update `AccountService.toSubscriptionStatus` to receive the membership role from its workspace loop and create the same map; do not use the current request’s role for other workspaces.

```ts
const features = resolveFeatureAccessMap({ planType, role });

return {
  planType,
  provider,
  enabledFeatures: enabledFeatureKeys(features),
  features,
  expiresAt,
  checkedAt,
};
```

`enabledFeatureKeys` must include only `available` entries, which reconciles Free local/agreement reminders while leaving all other live boundaries unchanged.

- [ ] **Step 4: Run targeted service tests to verify they pass**

Run: `npm test -- subscriptions.service.test.ts account.service.test.ts`.

Expected: PASS; status and account export include every key, planned Statistics is not enabled, and existing plan/expiry tests remain green.

- [ ] **Step 5: Check the generated API contract**

Run: `npm run openapi:check`.

Expected: FAIL if the checked-in OpenAPI document is stale; regenerate it with the repository’s `npm run openapi:generate`, review only the entitlement response diff, then rerun `npm run openapi:check` to PASS.

## Task 3: Use the resolver for all existing server-side feature gates

**Files:**
- Create: `D:\Projects\myself\weekly-us-api\src\modules\billing\require-feature.middleware.ts`
- Delete: `D:\Projects\myself\weekly-us-api\src\modules\billing\require-premium.middleware.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\ai\ai.routes.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\calendar\calendar.routes.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\exports\exports.routes.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\subscriptions.service.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\ai.routes.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\exports.routes.test.ts`
- Create: `D:\Projects\myself\weekly-us-api\tests\calendar.routes.test.ts`

**Interfaces:**
- Consumes: Task 1 catalog/resolver and `SubscriptionsRepository.findCurrentSubscriptionForWorkspace`.
- Produces: `resolveWorkspaceFeatureAccess(repository, auth, now?)`, `requireFeature(repository, featureKey): preHandlerHookHandler`, and `assertFeatureAccess(repository, auth, featureKey, now?)`.

- [ ] **Step 1: Write feature-guard tests before migrating routes**

```ts
await expect(assertFeatureAccess(repository, adultAuth, 'aiSummary'))
  .rejects.toMatchObject({ statusCode: 403, code: 'premium_required' });

await expect(assertFeatureAccess(repository, { ...adultAuth, role: 'viewer' }, 'aiSummary'))
  .rejects.toMatchObject({ statusCode: 403, code: 'feature_role_restricted' });

await expect(assertFeatureAccess(repository, adultAuth, 'advancedStatistics'))
  .rejects.toMatchObject({ statusCode: 404, code: 'feature_not_available' });
```

Update route mocks to expose `requireFeature`, then assert AI, Calendar, and export pass their specific keys (`aiSummary`, `googleCalendarSync`, `export`) instead of a generic Premium hook.

- [ ] **Step 2: Run guard and route tests to verify they fail**

Run: `npm test -- subscriptions.service.test.ts ai.routes.test.ts exports.routes.test.ts calendar.routes.test.ts`.

Expected: FAIL because no generic guard exists and Calendar has no route-contract test file.

- [ ] **Step 3: Implement the generic guard and retain a compatibility wrapper**

```ts
export function requireFeature(
  repository: SubscriptionEntitlementRepository,
  featureKey: SubscriptionFeatureKey,
): preHandlerHookHandler {
  return async (request) => {
    await assertFeatureAccess(repository, request.auth, featureKey);
  };
}
```

`resolveWorkspaceFeatureAccess` loads the workspace subscription once, converts stale/untrusted Premium to Free using the existing `hasTrustedPremiumEntitlement`, and returns the complete map. `assertFeatureAccess` selects one entry from that map and throws the exact errors in the approved design. Remove `require-premium.middleware.ts` after migrating every caller and its tests; do not retain a second policy implementation.

Replace route imports and guards with `requireFeature` for AI, Calendar, and export. Calendar route tests must cover unauthenticated, Free adult, Premium viewer, Premium adult, and a representative connect request.

- [ ] **Step 4: Run server-gate tests to verify they pass**

Run: `npm test -- subscriptions.service.test.ts ai.routes.test.ts exports.routes.test.ts calendar.routes.test.ts`.

Expected: PASS; exact existing Premium behavior is retained, viewers receive `feature_role_restricted`, and planned features cannot be authorized.

- [ ] **Step 5: Search for duplicate server Premium gate imports**

Run: `rg -n "requirePremiumAdultMember|assertPremiumEntitlement" src tests`.

Expected: No production import or implementation remains; all feature routes use `requireFeature`.

## Task 4: Align meeting history, templates, and saved summaries

**Files:**
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\meetings\meetings.service.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\meetings.service.test.ts`

**Interfaces:**
- Consumes: `resolveWorkspaceFeatureAccess` from Task 3.
- Produces: one resolved workspace access map per meeting read/sync operation; `unlimitedHistory`, `additionalTemplates`, and `aiSummary` decisions derive from that map.

- [ ] **Step 1: Add failing meeting-service contract tests**

```ts
it('uses the same stale entitlement decision for history and premium templates', async () => {
  repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(
    stalePremiumSubscription(),
  );

  const response = await service.listMeetings({ ...auth, planType: 'premium' }, new Date(now));

  expect(response.meetings).toHaveLength(4); // active + current free history limit
  await expect(service.syncMeetings({ ...auth, planType: 'premium' }, premiumTemplateRequest))
    .resolves.toMatchObject({ conflicts: [expect.objectContaining({ reason: 'invalid_reference' })] });
});
```

Keep and update existing tests for Free history, active Premium history, Free template rejection, Premium template acceptance, and saved-summary entitlement checks. Add a viewer test for `saveMeetingSummary` preserving the role error.

- [ ] **Step 2: Run meeting-service tests to verify they fail**

Run: `npm test -- meetings.service.test.ts`.

Expected: FAIL because templates still use `auth.planType` directly while history uses a separate trusted-entitlement check.

- [ ] **Step 3: Resolve feature access once per operation**

Create a private meeting-service helper that calls `resolveWorkspaceFeatureAccess` once per operation and returns the catalog map for the authenticated role and the supplied clock. Use it to:

```ts
const access = await this.getWorkspaceFeatureAccess(auth, now);
if (access.unlimitedHistory.state === 'available') {
  return this.meetingsRepository.listMeetingsForWorkspace(auth.workspaceId, 1000);
}
```

Validate non-default templates using `access.additionalTemplates.state === 'available'`; retain the current sync-conflict response for an unavailable template. Save AI summaries only when `aiSummary` resolves `available`, then preserve its existing ownership/reference validation. Do not alter `FREE_COMPLETED_MEETING_LIMIT` or template IDs.

- [ ] **Step 4: Run meeting tests to verify they pass**

Run: `npm test -- meetings.service.test.ts`.

Expected: PASS; all three meeting-specific Premium decisions use the same stale-entitlement policy.

- [ ] **Step 5: Run the API test suite after cross-module changes**

Run: `npm run typecheck && npm test && npm run openapi:check`.

Expected: PASS. If unrelated pre-existing failures occur, record their exact command and failure before handoff; do not weaken tests.

## Task 5: Carry the additive API map through the client subscription state

**Files:**
- Modify: `D:\Projects\myself\weekly-us\src\features\access\types.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\api\subscriptionsApi.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\types.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\services\backendSubscriptionProvider.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\services\revenueCatSubscriptionProvider.ts`
- Modify: `D:\Projects\myself\weekly-us\src\app\stores\subscription.ts`
- Create: `D:\Projects\myself\weekly-us\src\app\stores\__tests__\subscription.test.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\services\__tests__\revenueCatSubscriptionProvider.test.ts`

**Interfaces:**
- Consumes: API `features?: Record<FeatureKey, FeatureAccessDto>` and legacy `enabledFeatures` during rollout.
- Produces: `SubscriptionSnapshot.featureAccess` and store accessor `getFeatureAccess(featureKey)`.

- [ ] **Step 1: Write failing client mapping and store tests**

```ts
it('preserves a planned feature without marking it Premium-unlocked', () => {
  const snapshot = createSubscriptionSnapshotFromStatus(premiumStatusWithMap);

  expect(snapshot.featureAccess.advancedStatistics).toMatchObject({
    state: 'notYetAvailable', upgradeEligible: false,
  });
});

it('uses the explicit legacy fallback only when the API map is absent', () => {
  const store = useSubscriptionStore();
  store.applySnapshot(legacyFreeSnapshot);

  expect(store.getFeatureAccess('agreementReminders').state).toBe('available');
});
```

Update RevenueCat fixtures so both Free and Premium API status objects include `features`, and retain one explicit old-response fixture without it.

- [ ] **Step 2: Run client mapping tests to verify they fail**

Run: `npm test -- src/app/stores/__tests__/subscription.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts` from `D:\Projects\myself\weekly-us`.

Expected: FAIL because API and snapshot types have no feature map.

- [ ] **Step 3: Add API-compatible client types and state**

Define `FeatureTier`, `FeatureLifecycle`, `FeatureAccessState`, `FeatureAccessDto`, and `FeatureAccessMap` in `features/access/types.ts`. Make the API `features` field optional for rollout compatibility; make `SubscriptionSnapshot.featureAccess` required after adapter mapping.

```ts
function createSubscriptionSnapshotFromStatus(status: SubscriptionStatusDto): SubscriptionSnapshot {
  return {
    currentPlan: status.planType,
    featureAccess: status.features ?? createLegacyFeatureAccessMap(status),
    // preserve provider, entitlement, management, and checkedAt mapping
  };
}
```

Keep `enabledFeatureKeys` only as a compatibility getter if callers still use it. Add a store getter that returns the mapped access entry by key and does not recompute tiers from `currentPlan`.

- [ ] **Step 4: Run client mapping tests to verify they pass**

Run: `npm test -- src/app/stores/__tests__/subscription.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`.

Expected: PASS; browser and native purchase/restore flows retain the full server map.

- [ ] **Step 5: Typecheck the client**

Run: `npm run build`.

Expected: FAIL only until Task 6 migrates obsolete local-plan access callers; capture the compiler locations, then continue without casting around them.

## Task 6: Make client locks, routing, and reminders use server access states

**Files:**
- Modify: `D:\Projects\myself\weekly-us\src\features\access\featureAccess.config.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\access\featureAccessPolicy.ts`
- Create: `D:\Projects\myself\weekly-us\src\features\access\featureAccessPolicy.test.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\composables\useFeatureAccess.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\composables\useNotifications.ts`
- Modify: `D:\Projects\myself\weekly-us\src\app\router\index.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\components\PremiumLock.vue`
- Modify: `D:\Projects\myself\weekly-us\src\shared\components\UpgradePrompt.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\SettingsPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\features\localization\messages.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\composables\__tests__\useNotifications.test.ts`

**Interfaces:**
- Consumes: `SubscriptionSnapshot.featureAccess` from Task 5.
- Produces: `canUseFeature(featureKey)` based only on `state === 'available'`, and contextual UI that only offers Premium for `upgradeRequired`.

- [ ] **Step 1: Write failing pure-policy and reminder regression tests**

```ts
it.each([
  ['available', true], ['upgradeRequired', false], ['roleRestricted', false],
  ['notYetAvailable', false], ['unavailable', false],
])('allows a feature only when state is %s', (state, expected) => {
  expect(canUseFeatureAccess({ state } as FeatureAccessDto)).toBe(expected);
});

it('schedules agreement reminders for the Free access-map state', async () => {
  subscriptionStore.featureAccess.agreementReminders = freeAvailableReminder;
  await useNotifications().enableReminders();
  expect(scheduleReminderNotifications).toHaveBeenCalled();
});
```

Add policy tests that distinguish `upgradeRequired`, `roleRestricted`, and `notYetAvailable` for prompt selection. Do not add Vue component-test dependencies.

- [ ] **Step 2: Run client policy tests to verify they fail**

Run: `npm test -- src/features/access/featureAccessPolicy.test.ts src/shared/composables/__tests__/useNotifications.test.ts`.

Expected: FAIL because the policy still accepts a plan and role instead of an access-map entry.

- [ ] **Step 3: Remove local entitlement authority and render the correct state**

Keep `featureAccess.config.ts` only for localized labels, descriptions, and the existing history display limit; remove `plans`, `roles`, and `premiumFeatureKeys` from it. Change policy/composable functions to read `subscriptionStore.getFeatureAccess(featureKey)`.

```ts
export function canUseFeatureAccess(access: FeatureAccessDto | undefined) {
  return access?.state === 'available';
}
```

Make the router redirect based on the map. In `PremiumLock` and `UpgradePrompt`, show a purchase button only for `upgradeRequired`; for `roleRestricted` and `notYetAvailable`, render the new localized neutral message without a purchase CTA. Update the Settings redirect prompt to pass the resolved state. Make notifications use `useFeatureAccess()` so Free reminder behavior is driven by the server map.

Keep one documented legacy fallback inside the subscription adapter only; no page, route, or composable may reconstruct access from `currentPlan`.

- [ ] **Step 4: Run client unit tests to verify they pass**

Run: `npm test -- src/features/access/featureAccessPolicy.test.ts src/shared/composables/__tests__/useNotifications.test.ts src/app/stores/__tests__/subscription.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`.

Expected: PASS; Free reminders schedule, planned features do not show an upgrade action, and role-restricted features do not claim Premium will unlock them.

- [ ] **Step 5: Run the complete client checks**

Run: `npm test && npm run build`.

Expected: PASS. Inspect the typecheck output for eliminated references to `featureAccessConfig.plans`, `featureAccessConfig.roles`, and `premiumFeatureKeys`.

## Task 7: Contract verification and staged-release handoff

**Files:**
- Modify: `D:\Projects\myself\weekly-us\docs\superpowers\specs\2026-08-25-premium-entitlement-contract-design.md` only if implementation exposed a deliberate design correction.
- Modify: `D:\Projects\myself\weekly-us\docs\superpowers\plans\2026-08-25-premium-entitlement-contract.md` to check completed tasks and record exact verification commands/results.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: a reviewed API-first deployment sequence and evidence that the catalog is the single access decision.

- [ ] **Step 1: Add a final API contract assertion**

In `D:\Projects\myself\weekly-us-api\tests\api-contract.routes.test.ts`, add a status-response assertion requiring `features` to contain every catalog key and requiring the legacy `enabledFeatures` field to remain present.

```ts
expect(response.json()).toMatchObject({
  planType: 'free',
  enabledFeatures: expect.any(Array),
  features: { advancedStatistics: { state: 'notYetAvailable' } },
});
```

- [ ] **Step 2: Run the final API contract test**

Run: `npm test -- api-contract.routes.test.ts` from `D:\Projects\myself\weekly-us-api`.

Expected: PASS; a client can receive both fields during rollout.

- [ ] **Step 3: Run the full verification matrix**

Run in `D:\Projects\myself\weekly-us-api`:

```powershell
npm run typecheck
npm test
npm run openapi:check
```

Run in `D:\Projects\myself\weekly-us`:

```powershell
npm test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 4: Perform manual staged-release checks**

Deploy the API response expansion before the client release. In a non-production environment, verify each case through `/v1/subscriptions/status` and the app: Free owner, Free adult, Premium owner, Premium adult, and Premium viewer. Confirm that `advancedStatistics` is `notYetAvailable` for all five cases; confirm that Free reminders are `available`; confirm that a Premium viewer sees a role message rather than an upgrade prompt for AI/Calendar/export.

- [ ] **Step 5: Record rollout and rollback conditions**

Record in the plan checklist: keep `enabledFeatures` until all supported client versions consume `features`; rollback the client first if its rendering is wrong; rollback the API only after confirming a restored client still accepts the additive field. Do not remove the legacy field during Milestone 0.

## Self-review

### Spec coverage

- API-owned catalog and pure access resolver: Task 1.
- Additive status access map and account-export schema compatibility: Task 2.
- Generic server guards, stable errors, and provider-outage behavior: Task 3.
- Unified meeting-history/template/summary decisions: Task 4.
- Client storage and old-response compatibility: Task 5.
- Locks, routing, prompts, Free reminders, and planned-feature UI: Task 6.
- OpenAPI, final API contract, full checks, and API-first release: Task 7.

### Placeholder and consistency review

- No unchecked design choice is deferred: `advancedStatistics` is the only planned catalog key, and it resolves to `notYetAvailable`.
- The same field names are used throughout: `features`, `FeatureAccessDto`, `FeatureAccessMap`, `state`, `upgradeEligible`, and `requireFeature`.
- The plan retains `enabledFeatures` deliberately for compatibility and removes no current subscription verification safeguard.
- No commit command is included because repository instructions require explicit user authorization for commits.
