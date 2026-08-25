# Free Meeting History Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with reviewable checkpoints. Do not stage, commit, or push changes unless the user explicitly authorizes those Git actions.

**Goal:** Make the complete meeting history Free while refocusing Premium on active meeting-assistance tools and preserving safe API-first compatibility.

**Architecture:** The API adds `meetingHistory` as the canonical access key and keeps the two old history keys as Free compatibility aliases. The meeting service always returns the full workspace history. The client migrates history navigation and presentation to `meetingHistory`, removes every history lock/upsell, and centralizes owner-only purchase presentation in a small pure policy helper.

**Tech Stack:** Node.js, Fastify, TypeScript, Zod, Vitest, Vue 3, Pinia, vue-i18n, Vite.

## Global Constraints

- No database migration, pricing change, subscription-provider change, or new Premium capability.
- `meetingHistory` is Free, available, and usable by `owner`, `adult_member`, and `viewer`, even with expired, stale, or absent Premium entitlement.
- Keep `limitedHistory`, `unlimitedHistory`, and `enabledFeatures` during this milestone as API compatibility aliases; both history aliases resolve Free/available for every role.
- New client code must consume only `meetingHistory`; the aliases support older released clients only.
- Preserve workspace scoping, existing Premium server guards, and all existing AI, Calendar, template, export, and private-note policy unless explicitly listed below.
- Every localized copy change must be made in English, Ukrainian, and Spanish.
- Use `apply_patch` for edits. Do not add dependencies. Do not stage or commit without explicit user authorization.

---

## File structure

| File | Responsibility in this milestone |
| --- | --- |
| `weekly-us-api/src/modules/billing/feature-access.ts` | Defines `meetingHistory` and safe unlocked compatibility aliases. |
| `weekly-us-api/src/modules/billing/billing.schema.ts` | Keeps Free/Premium feature lists consistent with the catalog. |
| `weekly-us-api/src/modules/meetings/meetings.service.ts` | Removes the Free history cap and always lists the full workspace history. |
| `weekly-us-api/src/modules/meetings/meetings.repository.ts` | Removes the obsolete capped completed-meeting query. |
| `weekly-us-api/tests/feature-access.test.ts` | Proves canonical history and aliases resolve independently of entitlement. |
| `weekly-us-api/tests/meetings.service.test.ts` | Proves each member/entitlement state receives full history. |
| `weekly-us-api/tests/subscriptions.service.test.ts` | Proves subscription status exposes the canonical key and aliases. |
| `weekly-us-api/docs/openapi.json` | Generated OpenAPI contract for the changed feature-key enum. |
| `weekly-us/src/features/access/types.ts` | Adds the canonical client feature key. |
| `weekly-us/src/features/access/featureAccess.config.ts` | Holds presentation-only metadata for `meetingHistory` and removes the limit. |
| `weekly-us/src/features/access/legacyFeatureAccess.ts` | Treats history keys as Free in old-status fallback mapping. |
| `weekly-us/src/features/access/premiumPurchasePolicy.ts` | Provides owner-only purchase decisions without coupling UI components to workspace state. |
| `weekly-us/src/features/access/premiumPurchasePolicy.test.ts` | Covers owner, adult, and viewer purchase/prompt outcomes. |
| `weekly-us/src/shared/composables/useFeatureAccess.ts` | Removes per-meeting limit calculations. |
| `weekly-us/src/app/router/index.ts` | Uses canonical `meetingHistory` metadata for history routes. |
| `weekly-us/src/pages/HistoryPage.vue` | Removes locked cards and the full-history upgrade panel. |
| `weekly-us/src/pages/HomePage.vue` | Shows saved-history availability without the limit or Premium lock. |
| `weekly-us/src/pages/MeetingDetailsPage.vue` | Always renders the scoped meeting details. |
| `weekly-us/src/pages/MeetingSummaryPage.vue` | Always permits saved-summary history navigation. |
| `weekly-us/src/features/subscription/subscriptionPlans.ts` | Moves history to Free and removes it from Premium benefits. |
| `weekly-us/src/shared/components/UpgradePrompt.vue` | Allows a purchase CTA only for a Free workspace owner with `upgradeRequired`. |
| `weekly-us/src/pages/UpgradePage.vue` | Reframes Premium around AI, Calendar, export, templates, and private notes; hides billing actions from non-owners. |
| `weekly-us/src/pages/SettingsPage.vue` | Replaces history in the subscription card and exposes an owner-managed message to non-owners. |
| `weekly-us/src/features/localization/messages.ts` | Removes history-limit/up-sell copy and adds owner-managed Premium copy in all locales. |

## Task 1: Expand the API entitlement contract safely

**Files:**
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\billing\feature-access.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\billing\billing.schema.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\feature-access.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\subscriptions.service.test.ts`

**Interfaces:**
- Consumes: `resolveFeatureAccessMap({ planType, role })` and the existing subscription-status DTO.
- Produces: `SubscriptionFeatureKey` including `meetingHistory`; `features.meetingHistory`, `features.limitedHistory`, and `features.unlimitedHistory` all resolve `{ tier: 'free', state: 'available' }` for every authenticated workspace role.

- [ ] **Step 1: Write failing resolver and status tests**

Add the following cases to the existing API tests:

```ts
it.each(['owner', 'adult_member', 'viewer'] as const)(
  'makes canonical history available to a Free %s',
  (role) => {
    const access = resolveFeatureAccessMap({ planType: 'free', role });

    expect(access.meetingHistory).toMatchObject({
      key: 'meetingHistory', tier: 'free', state: 'available', upgradeEligible: false,
    });
  },
);

it('keeps both old history keys unlocked for a stale Premium record', async () => {
  const status = await service.getStatus({ ...auth, planType: 'premium' }, staleNow);

  expect(status.planType).toBe('free');
  expect(status.features.limitedHistory.state).toBe('available');
  expect(status.features.unlimitedHistory).toMatchObject({ tier: 'free', state: 'available' });
  expect(status.enabledFeatures).toEqual(expect.arrayContaining([
    'meetingHistory', 'limitedHistory', 'unlimitedHistory',
  ]));
});
```

Update existing expectations that call `unlimitedHistory` Premium-only. They must now assert that Premium-only access begins with `aiSummary` and not history.

- [ ] **Step 2: Run the focused API tests and confirm they fail**

Run from `D:\Projects\myself\weekly-us-api`:

```powershell
npm test -- tests/feature-access.test.ts tests/subscriptions.service.test.ts
```

Expected: failure because `meetingHistory` is not an enum key and `unlimitedHistory` still resolves Premium-only.

- [ ] **Step 3: Add the canonical key and compatibility alias policy**

In `feature-access.ts`:

1. Insert `meetingHistory` into `subscriptionFeatureKeys`.
2. Add this catalog entry immediately after `manualResponsibility`:

```ts
meetingHistory: {
  key: 'meetingHistory',
  tier: 'free',
  lifecycle: 'available',
  eligibleRoles: allRoles,
  enforcement: 'server',
},
```

3. Keep `limitedHistory` and `unlimitedHistory` in the key list and catalog, but make each `{ tier: 'free', lifecycle: 'available', eligibleRoles: allRoles }`. Add a short compatibility comment above each old entry; do not encode alias behavior in a second resolver.

In `billing.schema.ts`, include all three history keys in `freeSubscriptionFeatures`. Remove `unlimitedHistory` from the Premium-only additions in `premiumSubscriptionFeatures`; it remains present through the spread of Free features.

Do not change resolver precedence, trusted-entitlement logic, or any non-history feature entry.

- [ ] **Step 4: Run focused API tests and typecheck**

Run:

```powershell
npm test -- tests/feature-access.test.ts tests/subscriptions.service.test.ts
npm run typecheck
```

Expected: both commands pass; a stale Premium record still reports `planType: 'free'`, while all three history entries remain available.

## Task 2: Remove the server-side history cap

**Files:**
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\meetings\meetings.service.ts`
- Modify: `D:\Projects\myself\weekly-us-api\src\modules\meetings\meetings.repository.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\meetings.service.test.ts`

**Interfaces:**
- Consumes: `FeatureAccessMap.meetingHistory` from Task 1 and `MeetingsRepository.listMeetingsForWorkspace(workspaceId, 1000)`.
- Produces: `MeetingsService.listMeetings(auth, now?)` that returns the full workspace-owned meeting list for Free, Premium, stale-entitlement, and viewer contexts.

- [ ] **Step 1: Replace cap tests with full-history tests**

Replace the tests that expect `listCompletedMeetingsForFreePlan(workspaceId, 3)` with tests that prepare more than three completed meetings and expect the full query:

```ts
it.each([auth, adultAuth, viewerAuth])(
  'returns every completed meeting for a Free member',
  async (memberAuth) => {
    repos.meetings.listMeetingsForWorkspace.mockResolvedValue([
      completedMeeting('meeting_1'), completedMeeting('meeting_2'),
      completedMeeting('meeting_3'), completedMeeting('meeting_4'),
    ]);

    const response = await service.listMeetings({ ...memberAuth, planType: 'free' }, new Date(now));

    expect(response.meetings).toHaveLength(4);
    expect(repos.meetings.listMeetingsForWorkspace).toHaveBeenCalledWith('workspace_1', 1000);
  },
);

it('does not reduce history after a Premium entitlement becomes stale', async () => {
  repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(stalePremiumSubscription());
  repos.meetings.listMeetingsForWorkspace.mockResolvedValue(fourCompletedMeetings());

  await expect(service.listMeetings({ ...auth, planType: 'premium' }, staleNow))
    .resolves.toMatchObject({ meetings: expect.arrayContaining([expect.objectContaining({ id: 'meeting_4' })]) });
});
```

Keep the template and AI-summary tests: they must continue to prove stale Premium entitlement is denied for those actual Premium tools.

- [ ] **Step 2: Run the meeting-service test and confirm it fails**

Run:

```powershell
npm test -- tests/meetings.service.test.ts
```

Expected: failure because the service still calls the capped query and the repository port still requires it.

- [ ] **Step 3: Use canonical history and delete obsolete cap code**

In `meetings.service.ts`:

1. Remove `FREE_COMPLETED_MEETING_LIMIT` and `ACTIVE_MEETING_STATUSES` if they become unused.
2. Remove `listCompletedMeetingsForFreePlan` and `listMeetingsByStatusesForWorkspace` from `MeetingRepositoryPort` if neither is used after this task.
3. Replace `listVisibleMeetingRows` with one access assertion followed by the full query:

```ts
private async listVisibleMeetingRows(auth: AuthContext, now: Date) {
  const access = await this.getWorkspaceFeatureAccess(auth, now);

  if (access.meetingHistory.state !== 'available') {
    throw new ApiError(403, 'history_not_available', 'Meeting history is not available.');
  }

  return this.meetingsRepository.listMeetingsForWorkspace(auth.workspaceId, 1000);
}
```

The `history_not_available` branch is a defensive invariant: under this milestone's catalog it is unreachable for authenticated members. Do not read `limitedHistory`, `unlimitedHistory`, `planType`, or subscription timestamps in this method.

In `meetings.repository.ts`, delete `listCompletedMeetingsForFreePlan`; no route or service may retain a capped completed-history query.

- [ ] **Step 4: Run meeting and type checks**

Run:

```powershell
npm test -- tests/meetings.service.test.ts
npm run typecheck
rg -n "FREE_COMPLETED_MEETING_LIMIT|listCompletedMeetingsForFreePlan|unlimitedHistory\.state" src tests
```

Expected: tests and typecheck pass; the search has no history-cap production references. `unlimitedHistory` may remain only in billing compatibility tests/catalog code.

## Task 3: Regenerate and verify the API contract

**Files:**
- Modify: `D:\Projects\myself\weekly-us-api\docs\openapi.json`
- Modify: `D:\Projects\myself\weekly-us-api\tests\api-contract.routes.test.ts`

**Interfaces:**
- Consumes: updated `subscriptionFeatureSchema` and subscription-status route schema.
- Produces: checked-in OpenAPI documentation and an integration assertion preserving `features` and `enabledFeatures` compatibility.

- [ ] **Step 1: Add a subscription-status contract assertion**

In the existing authenticated API contract test, assert the additive response fields explicitly:

```ts
expect(response.json()).toMatchObject({
  planType: 'free',
  enabledFeatures: expect.arrayContaining([
    'meetingHistory', 'limitedHistory', 'unlimitedHistory',
  ]),
  features: {
    meetingHistory: { state: 'available', tier: 'free' },
    limitedHistory: { state: 'available', tier: 'free' },
    unlimitedHistory: { state: 'available', tier: 'free' },
  },
});
```

- [ ] **Step 2: Run the contract test and confirm it fails before regeneration**

Run:

```powershell
npm test -- tests/api-contract.routes.test.ts
npm run openapi:check
```

Expected: the test fails until status fixtures are updated; OpenAPI check fails because its generated enum lacks `meetingHistory`.

- [ ] **Step 3: Update fixtures and regenerate the OpenAPI document**

Make the API test fixture return the complete status DTO generated by the real resolver. Do not hand-maintain a partial feature map. Then run:

```powershell
npm run openapi:generate
```

Review the generated diff: it must add `meetingHistory` and preserve both aliases and `enabledFeatures`; it must not remove unrelated schemas or paths.

- [ ] **Step 4: Run contract verification**

Run:

```powershell
npm test -- tests/api-contract.routes.test.ts
npm run openapi:check
```

Expected: both commands pass.

## Task 4: Migrate client access state and history navigation

**Files:**
- Modify: `D:\Projects\myself\weekly-us\src\features\access\types.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\access\featureAccess.config.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\access\legacyFeatureAccess.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\composables\useFeatureAccess.ts`
- Modify: `D:\Projects\myself\weekly-us\src\app\router\index.ts`
- Modify: `D:\Projects\myself\weekly-us\src\pages\HistoryPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\HomePage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\MeetingDetailsPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\MeetingSummaryPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\features\access\featureAccessPolicy.test.ts`

**Interfaces:**
- Consumes: `features.meetingHistory` from the API or `createLegacyFeatureAccessMap` during the old-response fallback.
- Produces: routes and components that use `meetingHistory` and always display any locally available, workspace-authorized completed meeting without a Free-limit branch.

- [ ] **Step 1: Write failing canonical-key and no-limit tests**

Extend the existing pure access tests:

```ts
it('maps all history keys to Free access for a legacy Free status response', () => {
  const access = createLegacyFeatureAccessMap({ planType: 'free' });

  expect(access.meetingHistory.state).toBe('available');
  expect(access.limitedHistory.state).toBe('available');
  expect(access.unlimitedHistory.state).toBe('available');
});

it('does not expose a per-meeting history-limit helper', () => {
  expect('canAccessMeetingHistoryItem' in useFeatureAccess()).toBe(false);
});
```

If the composable is not safely callable outside a component, create a focused unit test for an exported pure helper instead; do not introduce component-test dependencies merely to test a deleted branch.

- [ ] **Step 2: Run the access test and confirm it fails**

Run from `D:\Projects\myself\weekly-us`:

```powershell
npm test -- src/features/access/featureAccessPolicy.test.ts
```

Expected: type/test failure because `meetingHistory` is absent and old fallback treats `unlimitedHistory` as Premium.

- [ ] **Step 3: Make `meetingHistory` the client canonical key**

1. Add `'meetingHistory'` to `FeatureKey` and create presentation metadata:

```ts
meetingHistory: {
  key: 'meetingHistory',
  label: 'Meeting history',
  description: 'Review every completed meeting, agreement, task, and saved summary.',
},
```

2. Remove `freeLimit` and its three-meeting wording from `limitedHistory` presentation metadata. Keep both old metadata entries only for compatibility rendering while older app code exists.
3. Remove `unlimitedHistory` from `premiumFeatureKeys` in `legacyFeatureAccess.ts`; add `meetingHistory` as a non-Premium key. The fallback must map all three history keys to `available` when the API access map is absent.
4. Remove `canAccessMeetingHistoryItem` and `getFreeLimit` from `useFeatureAccess.ts` after all callers migrate. Keep `canUseFeature` and `getFeatureAccessState` unchanged.
5. Change the three history route records (`history`, `meeting-details`, `meeting-summary`) to `meta: { requiresFeature: 'meetingHistory' }`; retain existing authentication and redirect behavior.
6. Remove every history lock branch and `<PremiumLock feature="unlimitedHistory">` wrapper from the four history-facing pages. Render their meeting content directly. Remove history upgrade navigation/imports and replace Home's conditional history label with a single all-history label.

- [ ] **Step 4: Search for forbidden history-lock references and run client checks**

Run:

```powershell
rg -n "canAccessMeetingHistoryItem|getFreeLimit\('limitedHistory'\)|feature=\"unlimitedHistory\"|lockedFeature: 'unlimitedHistory'|freeHistoryLimit" src
npm test -- src/features/access/featureAccessPolicy.test.ts
npm run build
```

Expected: the search has no results. The targeted test and build pass.

## Task 5: Reframe Premium and make purchase actions owner-only

**Files:**
- Create: `D:\Projects\myself\weekly-us\src\features\access\premiumPurchasePolicy.ts`
- Create: `D:\Projects\myself\weekly-us\src\features\access\premiumPurchasePolicy.test.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\subscriptionPlans.ts`
- Modify: `D:\Projects\myself\weekly-us\src\shared\components\UpgradePrompt.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\UpgradePage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\pages\SettingsPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\features\localization\messages.ts`

**Interfaces:**
- Consumes: `workspaceStore.currentRole`, `FeatureAccessState`, and the existing RevenueCat actions.
- Produces: `canPurchasePremium(role)` and `canOfferFeatureUpgrade(role, accessState)`, ensuring only an owner can initiate purchase/restore/manage flows and contextual prompts retain state-aware messaging.

- [ ] **Step 1: Add failing pure-policy tests**

Create `premiumPurchasePolicy.test.ts` with the exact role/state matrix:

```ts
describe('Premium purchase policy', () => {
  it.each([
    ['owner', true], ['adult_member', false], ['viewer', false],
  ] as const)('allows %s to purchase Premium: %s', (role, expected) => {
    expect(canPurchasePremium(role)).toBe(expected);
  });

  it.each([
    ['owner', 'upgradeRequired', true],
    ['adult_member', 'upgradeRequired', false],
    ['viewer', 'roleRestricted', false],
    ['owner', 'notYetAvailable', false],
  ] as const)('offers a feature upgrade only for %s/%s', (role, state, expected) => {
    expect(canOfferFeatureUpgrade(role, state)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the policy test and confirm it fails**

Run:

```powershell
npm test -- src/features/access/premiumPurchasePolicy.test.ts
```

Expected: failure because no purchase-policy module exists.

- [ ] **Step 3: Implement the pure purchase policy**

Create `premiumPurchasePolicy.ts`:

```ts
import type { FeatureAccessState, UserRole } from './types';

export function canPurchasePremium(role: UserRole) {
  return role === 'owner';
}

export function canOfferFeatureUpgrade(role: UserRole, state: FeatureAccessState | undefined) {
  return canPurchasePremium(role) && state === 'upgradeRequired';
}
```

Do not change server authorization: the existing restore/manage routes already require an owner.

- [ ] **Step 4: Update plan comparison and Premium surfaces**

1. In `subscriptionPlans.ts`, make Free show `Meeting history` with `featureKey: 'meetingHistory'`; remove `Last 3 meetings history`. Remove `Unlimited meeting history` from Premium benefits. Keep AI summaries, extra templates, private notes, Calendar sync, and export.
2. In `UpgradePrompt.vue`, read `workspaceStore.currentRole` and use `canOfferFeatureUpgrade`. When state is `upgradeRequired` but the role is not owner, render `premium.ownerManaged` without the button. Preserve `roleRestricted`, planned, and unavailable handling.
3. In `UpgradePage.vue`, read the workspace role and use `canPurchasePremium`. Hide/disable paywall and restore actions for non-owners and render `upgrade.ownerManaged`. Keep management only for an owner with `canManageSubscription`.
4. In `SettingsPage.vue`, replace the unlimited-history benefit with at least AI summaries, Calendar sync, and export. When the workspace is Free, render the Upgrade link only for an owner; otherwise render `settings.subscriptionOwnerManaged`.
5. In all three locales, remove history-limit and full-history-upgrade strings from Home, History, meeting details, meeting summaries, feature metadata, settings benefits, and Upgrade benefits. Add equivalent strings for all-history availability, owner-managed purchase, and revised Premium hero/benefit copy. Update Upgrade benefit keys to `aiSummaries`, `templates`, `calendarSync`, `export`, and `privateNotes`; use the same keys in all locales and `UpgradePage.vue`.

- [ ] **Step 5: Run policy and complete client verification**

Run:

```powershell
npm test -- src/features/access/premiumPurchasePolicy.test.ts src/features/access/featureAccessPolicy.test.ts
npm test
npm run build
```

Expected: policy tests, complete client suite, and build pass. The build must not report missing localization keys.

## Task 6: End-to-end verification and rollout handoff

**Files:**
- Modify: `D:\Projects\myself\weekly-us\docs\superpowers\plans\2026-08-25-free-meeting-history.md`
- Modify only if a design correction is required: `D:\Projects\myself\weekly-us\docs\superpowers\specs\2026-08-25-premium-history-free-design.md`

**Interfaces:**
- Consumes: completed API and client changes from Tasks 1–5.
- Produces: documented verification evidence and a safe API-first release checklist.

- [ ] **Step 1: Run the complete API verification matrix**

Run from `D:\Projects\myself\weekly-us-api`:

```powershell
npm run typecheck
npm test -- --exclude tests/env.test.ts
npm run openapi:check
```

Expected: all commands pass. If the unfiltered `npm test` is also run, record any pre-existing SMTP assertion or full-parallel timeout failures separately; do not modify unrelated environment, auth, password-reset, or OpenAPI tests to mask them.

- [ ] **Step 2: Run the complete client verification matrix**

Run from `D:\Projects\myself\weekly-us`:

```powershell
npm test
npm run build
```

Expected: both commands pass. Record the pre-existing Vite native-config and chunk-size warnings only if they still appear; do not address them in this milestone.

- [ ] **Step 3: Perform manual role and rollout checks**

In a non-production environment, deploy API before client and verify:

1. A Free owner, adult member, and viewer each see and open a fourth-or-older completed meeting and its saved summary.
2. The status response for each role contains `meetingHistory`, `limitedHistory`, and `unlimitedHistory` as Free/available.
3. A stale Premium subscription remains Free for AI/Calendar/export but does not restrict history.
4. A Free owner opening a Premium tool receives the contextual purchase path.
5. A Free adult member receives the owner-managed message for the same tool.
6. A viewer receives role-restriction messaging for adult-only Premium tools and no purchase CTA.
7. No History, Home, meeting-detail, or saved-summary surface contains a history upgrade card, lock, or three-meeting wording.

- [ ] **Step 4: Record results and release conditions**

Check completed plan items and record the exact verification commands/results. Record these release conditions verbatim:

- Deploy API before client.
- Retain `enabledFeatures`, `limitedHistory`, and `unlimitedHistory` until all supported clients use `meetingHistory`.
- Roll back the client first if presentation is wrong; the additive API aliases are compatible with both app versions.
- Do not remove compatibility fields during Milestone 1.

## Self-review

### Spec coverage

- Free full history and all-role access: Tasks 1 and 2.
- Alias and `enabledFeatures` compatibility: Tasks 1 and 3.
- No history locking in client routes/pages: Task 4.
- Premium positioning and owner-managed purchase experience: Task 5.
- API-first rollout, checks, and manual role validation: Task 6.

### Placeholder and consistency review

- `meetingHistory` is the sole canonical new key throughout the plan.
- `limitedHistory` and `unlimitedHistory` are deliberately retained only as Free compatibility aliases.
- No task adds pricing, a database migration, a new provider integration, or a new Premium feature.
- The plan requires no commit because the repository rules require explicit user authorization before staging or committing.
