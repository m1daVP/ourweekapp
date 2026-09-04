# AI Recap Allowance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use backend recap allowance consistently across mobile generation flows without hiding already-saved recaps when credits run out.

**Architecture:** Normalize allowance into the shared subscription snapshot, keep its availability in the subscription store, and use the existing AI coordinator for permission checks and post-request refresh. Separate saved-summary rendering from generation controls on both meeting pages; preserve AI-02 synchronization and all existing meeting/export access boundaries.

**Tech Stack:** Node 24, npm, Vue 3, Pinia, TypeScript 6, vue-i18n, Vitest, Vue Test Utils, happy-dom. Use installed versions; no dependency changes.

Design: [AI-03 recap allowance and saved-summary access](../specs/2026-09-04-ai-recap-allowance-design.md).

Status: implemented on 2026-09-04. Automated verification and remaining baseline/manual limitations are recorded in the linked design's Implementation result. The user approved implementation of AI-03 plus the narrow AI-04 safeguard.

The execution skills named in the standard header are not available in this session. Inline test-first execution is the available fallback; do not claim to have run those skills. No Git commit is part of this plan.

## Global Constraints

- No database migration, backend billing-policy change, dependency addition, funded provider call, production configuration change, deployment, or Git staging/commit/push is authorized by this design.
- The backend remains authoritative and still validates every generation request.
- Unknown, loading, or failed-refresh allowance must not unlock generation, including for Premium.
- Do not derive credits from plan name, decrement a local counter, or assume three credits merely because a user is Free.
- Preserve existing meeting lookup/access checks and route guards.
- Keep export's independent entitlement checks.
- Do not add provider retries, change timeouts, or change credit settlement.
- A failed allowance refresh after successful recap persistence must not turn that recap into a generation failure or discard it.
- Do not replace canonical tasks/agreements in this task; the separate AI-09 finding remains tracked.
- The user-owned P0 provider work remains separate.
- Preserve unrelated changes and recheck Git status before execution.
- Mobile changes require filesystem authorization because `D:/Projects/myself/weekly-us` is outside the current writable root. Use the normal permission mechanism before mobile writes.
- Keep specifications and plans in the backend's `docs/superpowers/specs/` and `docs/superpowers/plans/`; do not recreate root `AI_03_*` files.

## Repository and file map

Runtime paths and commands below are relative to **`D:/Projects/myself/weekly-us`**. Documentation paths explicitly prefixed `weekly-us-api/` are in the backend repository. Do not run mobile commands from the backend root.

| Unit | Files | Responsibility |
| --- | --- | --- |
| Contract and mapping | `src/features/subscription/types.ts`, `src/shared/api/subscriptionsApi.ts`, `src/features/subscription/services/backendSubscriptionProvider.ts` | One typed, top-level allowance for Free and Premium |
| Store | `src/app/stores/subscription.ts` | Permission, invalidation, refresh, late-response protection |
| Coordinator | `src/features/meeting/aiSummaryService.ts` | Gate shared generation and refresh allowance after a charged/denied request |
| Entry points | `src/features/meeting/composables/useMeetingSession.ts`, `src/pages/MeetingSummaryPage.vue`, `src/pages/MeetingDetailsPage.vue` | Use common permission; keep completion and saved recaps intact |
| Shared recovery UI | new `src/features/meeting/components/RecapAllowanceStatus.vue`, `src/features/localization/messages.ts` | Small, reused allowance status and refresh control |
| Tests | provider/store/coordinator/session/page/component suites named below | Behavior and contract regression coverage |

The small shared status component avoids duplicating count/date/error copy across two pages. It owns no generation or billing decisions; those remain in the store/coordinator.

## Task 1: Normalize the subscription allowance contract

**Files:**

- Modify `src/features/subscription/types.ts`.
- Modify `src/shared/api/subscriptionsApi.ts`.
- Modify `src/features/subscription/services/backendSubscriptionProvider.ts`.
- Create `src/features/subscription/services/__tests__/backendSubscriptionProvider.test.ts`.
- Extend `src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`.
- Update existing typed `SubscriptionSnapshot` fixtures found with `rg -n 'SubscriptionSnapshot|assistantRecap' src tests/contract`.

**Interfaces:**

- Produces `AssistantRecapAllowance` and required `SubscriptionSnapshot.assistantRecap: AssistantRecapAllowance | null`.
- Keeps `SubscriptionStatusDto.assistantRecap?: AssistantRecapAllowance` for old backend compatibility.
- Keeps `createSubscriptionSnapshotFromStatus(status: SubscriptionStatusDto): SubscriptionSnapshot` unchanged as a function signature.

- [x] **Step 1: Write the mapper regression matrix.** Import the existing mapper; mock localization to return keys as existing provider tests do. Use this fixture and test body:

```ts
const status: SubscriptionStatusDto = {
  planType: 'free', provider: null, enabledFeatures: [],
  expiresAt: null, checkedAt: '2026-09-04T10:00:00.000Z',
};

it.each([
  ['free', 3, 0, 3, true, null],
  ['free', 3, 3, 0, false, null],
  ['premium', 30, 2, 28, true, '2026-10-04T10:00:00.000Z'],
  ['premium', 30, 30, 0, false, '2026-10-04T10:00:00.000Z'],
  ['free', 3, 0, 3, false, null], // viewer denied by backend
] as const)('preserves %s allowance', (planType, limit, used, remaining, canGenerate, periodEndsAt) => {
  const assistantRecap = { limit, used, remaining, canGenerate, periodEndsAt };
  const snapshot = createSubscriptionSnapshotFromStatus({ ...status, planType, assistantRecap });
  expect(snapshot.assistantRecap).toEqual(assistantRecap);
  expect(snapshot.entitlements.premium).not.toHaveProperty('assistantRecap');
});

it('normalizes absent legacy allowance to unavailable', () => {
  expect(createSubscriptionSnapshotFromStatus(status).assistantRecap).toBeNull();
});
```

The numeric values above are test data, not new product defaults. Add to the native provider's existing backend-status mock:

```ts
vi.mocked(getSubscriptionStatus).mockResolvedValue({
  ...freeStatus,
  assistantRecap: { limit: 3, used: 1, remaining: 2, canGenerate: true, periodEndsAt: null },
});
expect((await createRevenueCatSubscriptionProvider().getCurrentPlan()).assistantRecap?.remaining).toBe(2);
```

- [x] **Step 2: Run the focused tests before implementation.**

```powershell
node node_modules/vitest/vitest.mjs run src/features/subscription/services/__tests__/backendSubscriptionProvider.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts
```

Expected: new top-level mapping assertions fail; existing native purchase tests remain meaningful.

- [x] **Step 3: Define and map the shared type.**

```ts
export interface AssistantRecapAllowance {
  limit: number;
  used: number;
  remaining: number;
  periodEndsAt: string | null;
  canGenerate: boolean;
}
// In SubscriptionSnapshot:
assistantRecap: AssistantRecapAllowance | null;
// In SubscriptionStatusDto, importing the shared type:
assistantRecap?: AssistantRecapAllowance;
// In the returned snapshot, not its Premium entitlement:
assistantRecap: status.assistantRecap ? { ...status.assistantRecap } : null,
```

Remove the old nested declaration/assignment after confirming no consumer requires it. Existing snapshots without backend allowance, including native pending-activation snapshots, must produce `null`; do not synthesize Free credits. Add `assistantRecap: null` to legacy typed fixtures unless a test explicitly needs credits.

- [x] **Step 4: Rerun both provider suites and the provider-selection suite.** Assert native purchase/restore responses still use the backend mapper and the pending-activation test returns a null allowance. Review the diff for unrelated feature-map changes; there should be none.

## Task 2: Make allowance state fail closed and survive refresh/reset races

**Files:** modify `src/app/stores/subscription.ts`; create `src/app/stores/__tests__/subscription.test.ts`.

**Interfaces:**

- Consumes `SubscriptionSnapshot.assistantRecap` from Task 1.
- Produces `canGenerateAssistantRecap: boolean`, `isCheckingRecapAllowance: boolean`, and `invalidateAssistantRecap(): void`.
- Preserves public async action return contracts, including `refreshCurrentPlan(): Promise<void>` and purchase/restore booleans.

- [x] **Step 1: Add store tests using real Pinia and a mocked `subscriptionsService`.** Seed snapshots through the real mapper from Task 1. Mock `getCurrentPlan`, `getAvailablePlans`, and action results rather than native billing. Include these assertions:

```ts
setActivePinia(createPinia());
const store = useSubscriptionStore();
expect(store.assistantRecap).toBeNull();
expect(store.canGenerateAssistantRecap).toBe(false);
store.applySnapshot(createSubscriptionSnapshotFromStatus({
  planType: 'premium', provider: 'revenuecat', enabledFeatures: [],
  expiresAt: null, checkedAt: '2026-09-04T10:00:00.000Z',
}));
expect(store.canGenerateAssistantRecap).toBe(false);
```

For refresh cases, set a valid top-level allowance via a complete snapshot, then defer the mocked status request:

```ts
let resolveStatus!: (snapshot: SubscriptionSnapshot) => void;
vi.mocked(subscriptionsService.getCurrentPlan).mockReturnValueOnce(
  new Promise((resolve) => { resolveStatus = resolve; })
);
const pending = store.refreshCurrentPlan();
expect(store.isCheckingRecapAllowance).toBe(true);
expect(store.canGenerateAssistantRecap).toBe(false);
store.$reset();
resolveStatus(createSubscriptionSnapshotFromStatus({
  planType: 'free', provider: null, enabledFeatures: [], expiresAt: null,
  checkedAt: '2026-09-04T10:00:00.000Z',
  assistantRecap: { limit: 3, used: 0, remaining: 3, periodEndsAt: null, canGenerate: true },
}));
await pending;
expect(store.assistantRecap).toBeNull();
expect(store.canGenerateAssistantRecap).toBe(false);
```

Also cover: successful refresh enables eligible Free users; backend denial disables a viewer with remaining credits; failed refresh invalidates allowance but retains existing non-recap subscription fields; overlapping read refreshes cannot apply the older response after the newer one.

- [x] **Step 2: Run `node node_modules/vitest/vitest.mjs run src/app/stores/__tests__/subscription.test.ts` and record the intended failures.**

- [x] **Step 3: Add explicit state and invalidation.**

```ts
// State field:
assistantRecap: AssistantRecapAllowance | null;
// Getters:
isCheckingRecapAllowance: (state) => state.isLoading || state.isPurchasing || state.isRestoring,
canGenerateAssistantRecap: (state) =>
  !state.isLoading && !state.isPurchasing && !state.isRestoring &&
  state.assistantRecap?.canGenerate === true,
// Action:
invalidateAssistantRecap() {
  this.assistantRecap = null;
}
```

Use `snapshot.assistantRecap ?? null` when applying a snapshot. In the catch paths of snapshot-producing actions invalidate allowance, retaining existing safe error messages and unrelated entitlement state. Do not invalidate merely because opening the subscription-management UI failed: that action returns no allowance snapshot.

- [x] **Step 4: Guard asynchronous snapshots across reset and overlapping reads.** Avoid a reusable reset-to-zero epoch. A module counter only allocates session generations; store instances still own their data:

```ts
let nextSubscriptionEpoch = 0;
// In the existing state factory:
subscriptionEpoch: ++nextSubscriptionEpoch,
planReadId: 0,
// At the start of refreshCurrentPlan / initializeSubscriptions / refreshCustomerInfo:
const epoch = this.subscriptionEpoch;
const readId = ++this.planReadId;
const isCurrent = () => this.subscriptionEpoch === epoch && this.planReadId === readId;
// After each await, before applying snapshot/error or clearing isLoading:
if (!isCurrent()) return;
```

Use the correct existing return value (`false` for a stale boolean action) when abandoning stale work. Guard writes in `catch` and `finally` too, but never return from `finally`: use `if (isCurrent()) this.isLoading = false` so cleanup cannot replace a result/error. Capture/check the epoch in purchase/restore/paywall actions too before applying snapshot/status/error or clearing flags. When those operations supersede earlier plan reads, increment `planReadId` and clear the superseded read's `isLoading` flag; their own purchase/restore flag now blocks generation. Do not change native billing calls or success semantics. For `initializeSubscriptions`, retain its parallel plan/status reads but guard both results after `Promise.all`.

Add a deferred native-action result after `$reset()` test and retain existing auth reset tests. This is response-application safety, not a change to authentication or purchase policy.

- [x] **Step 5: Rerun store, provider, auth-reset, and page-refresh tests.** Confirm existing callers still receive the original action return types and no stale operation leaves the current store stuck in a loading state.

## Task 3: Centralize generation permission and allowance refresh

**Files:** modify `src/features/meeting/aiSummaryService.ts`; extend `src/features/meeting/__tests__/aiGenerationFlow.test.ts` and `src/features/meeting/__tests__/aiSummaryService.test.ts`.

**Interfaces:**

- Consumes store getters/actions from Task 2 and the existing AI-02 coordinator.
- Preserves `generateMeetingSummary(meeting: Meeting): Promise<MeetingSummary>`.
- Adds `AiRecapUnavailableError` for a local unavailable allowance and `isRecapAllowanceExhausted(error: unknown): boolean` for the backend code.
- Keeps `parseAiQuotaError` restricted to hourly anti-abuse errors.

- [x] **Step 1: Extend the existing coordinator harness.** Seed the real subscription store with valid allowance in `beforeEach`; spy on `refreshCurrentPlan` so tests never call billing/network. Keep the existing meeting/source/sync fixtures, including `checkInCompleted`.

```ts
const subscription = useSubscriptionStore();
subscription.assistantRecap = {
  limit: 3, used: 0, remaining: 3, periodEndsAt: null, canGenerate: true,
};
vi.spyOn(subscription, 'refreshCurrentPlan').mockResolvedValue(undefined);
```

Add disabled-permission and exhaustion tests:

```ts
subscription.invalidateAssistantRecap();
await expect(generateMeetingSummary(source)).rejects.toMatchObject({ name: 'AiRecapUnavailableError' });
expect(mocks.sync).not.toHaveBeenCalled();
expect(mocks.generate).not.toHaveBeenCalled();
```

```ts
const exhausted = new ApiClientError('No recaps remain.', {
  status: 429, code: 'recap_allowance_exhausted',
});
mocks.generate.mockRejectedValueOnce(exhausted);
await expect(generateMeetingSummary(source)).rejects.toBe(exhausted);
expect(subscription.refreshCurrentPlan).toHaveBeenCalledOnce();
expect(subscription.canGenerateAssistantRecap).toBe(false);
expect(parseAiQuotaError(exhausted)).toBeNull();
```

Test success refresh once, local application conflict after backend success still refreshes, failed refresh preserves successful summary/revision, failed refresh preserves the original exhaustion error, and sync/provider failures other than exhaustion do not trigger unrelated allowance refresh.

- [x] **Step 2: Run the two AI suites before implementation; confirm new assertions fail.**

- [x] **Step 3: Add the local guard and wrap only the provider/result section.**

```ts
export class AiRecapUnavailableError extends Error {
  constructor() {
    super('Recap allowance is unavailable.');
    this.name = 'AiRecapUnavailableError';
  }
}
export function isRecapAllowanceExhausted(error: unknown) {
  return error instanceof ApiClientError &&
    error.status === 429 && error.code === 'recap_allowance_exhausted';
}
```

At coordinator entry and again after the completion-sync await, require `subscription.canGenerateAssistantRecap`; throw the local typed error otherwise. Preserve the existing source-revision checks. Then use this orchestration around the current provider, normalize, reconcile, and apply code:

```ts
let refreshAllowance = false;
try {
  const response = await generateBackendAiSummary(meeting.id, acknowledged.serverRevision!);
  refreshAllowance = true;
  const summary = normalizeBackendSummary(response.summary, meeting.id);
  let meetingSync = response.meetingSync;
  if (!meetingSync) {
    const authoritative = (await listMeetings()).meetings.find(
      (item) => item.id === meeting.id
    );
    if (!authoritative?.aiSummary || authoritative.aiSummary.id !== summary.id ||
        !Number.isInteger(authoritative.serverRevision)) {
      throw new Error('AI summary could not be synchronized.');
    }
    meetingSync = {
      meetingId: meeting.id,
      sourceServerRevision: source.serverRevision!,
      serverRevision: authoritative.serverRevision!,
      updatedAt: authoritative.updatedAt,
    } satisfies AiMeetingSyncDto;
  }
  const applied = useMeetingsStore().applyRemoteAiSummary(source, summary, meetingSync);
  if (!applied) throw new Error('Meeting changed while applying the AI summary.');
  return summary;
} catch (error) {
  if (isRecapAllowanceExhausted(error)) refreshAllowance = true;
  throw error;
} finally {
  if (refreshAllowance) {
    subscription.invalidateAssistantRecap();
    try {
      await subscription.refreshCurrentPlan();
    } catch {
      // Defensive: normal store failures are already recorded and swallowed by the store.
      subscription.invalidateAssistantRecap();
    }
  }
}
```

Keep normalization/reconciliation/application inside this `try` so a backend success that later conflicts still refreshes. Invalidate before the refresh await; do not mask the original result/error. Do not place completion sync inside this wrapper, since sync failure is not evidence of a credit change.

- [x] **Step 4: Rerun the coordinator and quota tests plus the AI-02 sync regression suite.** Existing test setups must now explicitly seed allowance, not bypass the guard. Do not change their revision/identity assertions.

## Task 4: Apply generation gates and preserve saved recap display

**Files:**

- Modify `src/features/meeting/composables/useMeetingSession.ts`.
- Modify `src/pages/MeetingSummaryPage.vue` and `src/pages/MeetingDetailsPage.vue`.
- Create `src/features/meeting/components/RecapAllowanceStatus.vue` and `src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`.
- Create `src/pages/__tests__/MeetingSummaryPage.test.ts` and `src/pages/__tests__/MeetingDetailsPage.test.ts`.
- Create `src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts`; preserve the existing pure-helper session suite.
- Modify `src/features/localization/messages.ts`; use its existing completeness suite.

**Interfaces:**

- `RecapAllowanceStatus` takes no props, reads subscription/workspace state, and invokes only `refreshCurrentPlan()` for deliberate retry. It never calls generation.
- All three entry points consume `subscriptionStore.canGenerateAssistantRecap`.
- Page generation functions and `useMeetingSession().finishMeeting()` retain their current public behavior/return contracts.

- [x] **Step 1: Add page and completion regressions before editing callers.** Use `// @vitest-environment happy-dom`, real Pinia, Vue Test Utils, and mocked navigation/native services, following `src/pages/__tests__/UpgradePage.test.ts`. Use a real i18n instance or the existing key-returning translation mock with `locale`, `te`, and `t` supplied. Stub export/native generation APIs, not permission calculations.

Create a completed fixture with a saved `shortSummary: 'Keep Sunday planning short.'`, valid dates, empty sections/participants, and `checkInCompleted: true`. Seed it in the meetings store. For both pages test Free exhausted and expired Premium mapped to Free: the text is visible and no generation button appears. In the summary-page harness mock `navigator.share` and click the actual share button:

```ts
const share = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'share', { configurable: true, value: share });
await wrapper.get('[data-testid="share-meeting-summary"]').trigger('click');
await flushPromises();
expect(share).toHaveBeenCalledWith(expect.objectContaining({
  text: expect.stringContaining('Keep Sunday planning short.'),
}));
```

Add `data-testid="share-meeting-summary"` to the existing share button and `data-testid="generate-meeting-recap"` to each generation button to make behavioral tests stable. A missing meeting must not expose a recap or call share/generate. On details, test with the actual `PremiumLock` behavior for export, not an unconditional slot stub, so the export gate regression is meaningful.

For manual generation with no saved summary, assert Free with allowance calls the coordinator, while unknown/exhausted/viewer states do not. For completion, mount a small harness whose setup exposes `useMeetingSession()`, populate a valid active meeting ready for completion, and invoke its real `finishMeeting()` action. Mock the coordinator and navigation only. Check:

```ts
await session.finishMeeting();
expect(useMeetingsStore().meetings.find((item) => item.id === meetingId)?.status).toBe('completed');
expect(generateMeetingSummary).not.toHaveBeenCalled(); // unknown/exhausted/viewer case
```

Repeat with eligible Free allowance and expect one coordinator call. Reject it with an offline/sync error and assert completion remains saved and navigation still goes to the summary. This exercises the actual caller, not a source-text search or a pure permission helper.

- [x] **Step 2: Run the new suites and record failures caused by current Premium-only gates.**

- [x] **Step 3: Replace generation gates and remove duplicate refresh.**

```ts
// useMeetingSession.ts, after local completion succeeds:
if (subscriptionStore.canGenerateAssistantRecap) {
  // Preserve the existing completedMeeting lookup, coordinator call, and failure navigation.
}
// Both pages, retaining existing completed/no-summary/in-flight checks:
subscriptionStore.canGenerateAssistantRecap
```

Import/create the subscription store where missing. Delete only the summary page's post-generation `refreshCurrentPlan()`; Task 3 now owns it. Do not remove `useFeatureAccess` if other feature gates still use it. No caller uses `saveAiSummary`.

- [x] **Step 4: Make saved insights independent of generation allowance.** In `aiInsightState`, keep the missing-meeting guard first, then saved insight, then active generation/error, then empty. The status component describes unavailable generation; eliminate the old blanket `locked`/Premium-upgrade branch. Do not mark a saved insight unavailable because allowance is loading.

```ts
if (!accessibleMeeting.value || !meetingSummary.value) return 'empty';
if (meetingSummary.value.aiInsight) return 'available';
// Existing generation/error branches follow; otherwise return 'empty'.
// In getShareText:
const visibleAiInsight = summary.aiInsight;
```

On details, unwrap only the `PremiumLock feature="aiSummary"` wrapper, retaining its existing section, disclaimer, saved content, and gated generation control. Leave `PremiumLock feature="export"` and its action checks unchanged. Do not alter task/agreement sourcing.

- [x] **Step 5: Add a focused reusable allowance/recovery status component and localized messages.** The component uses this precedence:

```ts
const state = computed(() => {
  if (workspace.currentUserRole === 'viewer') return 'restricted';
  if (subscription.isCheckingRecapAllowance) return 'checking';
  if (!subscription.assistantRecap) return 'unavailable';
  if (!subscription.canGenerateAssistantRecap && subscription.assistantRecap.remaining > 0) return 'restricted';
  return subscription.assistantRecap.periodEndsAt ? 'premium' : 'free';
});
```

Render a status paragraph and a refresh button only for unknown/unavailable or known non-generating non-viewer allowance. Disable refresh while checking. Refresh merely obtains status; it must not trigger generation. Show no upgrade link for viewer/restricted/unavailable states. Keep count/status visible beside saved recaps as well as empty states. For Premium renewal dates use `Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long' })` only after validating the date; use `premiumNoDate` if invalid, so date formatting cannot hide a saved recap.

Add the following `ai.recap` keys to all three catalogues, preserving unrelated keys:

| Key | English | Ukrainian | Spanish |
| --- | --- | --- | --- |
| `checking` | Checking recap availability… | Перевіряємо доступність підсумків… | Comprobando la disponibilidad de resúmenes… |
| `unavailable` | Recap availability could not be confirmed. Refresh to try again. | Не вдалося підтвердити доступність підсумків. Оновіть, щоб спробувати ще раз. | No se pudo confirmar la disponibilidad de resúmenes. Actualiza para intentarlo de nuevo. |
| `refresh` | Refresh availability | Оновити доступність | Actualizar disponibilidad |
| `restricted` | Your household role cannot generate AI recaps. | Ваша роль у домогосподарстві не дозволяє створювати ШІ-підсумки. | Tu rol en el hogar no permite generar resúmenes con IA. |
| `freeRemaining` | Free recaps remaining: {count} | Залишилося безкоштовних підсумків: {count} | Resúmenes gratuitos restantes: {count} |
| `freeExhausted` | No free recaps remain. Saved recaps are still available. | Безкоштовних підсумків більше немає. Збережені підсумки залишаються доступними. | No quedan resúmenes gratuitos. Los resúmenes guardados siguen disponibles. |
| `premiumRemaining` | Recaps available: {count} of {limit}, until {date}. | Доступно підсумків: {count} із {limit}, до {date}. | Resúmenes disponibles: {count} de {limit}, hasta el {date}. |
| `premiumExhausted` | No recaps remain for this period. Allowance renews on {date}. | Підсумків на цей період більше немає. Ліміт поновиться {date}. | No quedan resúmenes para este período. La disponibilidad se renueva el {date}. |
| `premiumNoDate` | Recaps available: {count} of {limit}. | Доступно підсумків: {count} із {limit}. | Resúmenes disponibles: {count} de {limit}. |

Render exhausted wording only for known zero allowance, not absent data. In page catches use `isRecapAllowanceExhausted(error)` and `AiRecapUnavailableError` to defer to the status component rather than displaying a misleading provider failure. Preserve existing hourly quota messages and the ordinary error fallback for other failures. Completion can retain its existing generic failure navigation; saved content and the shared status component take precedence on the destination page.

- [x] **Step 6: Test recovery UI and the final-credit transition.** The component suite must assert all state variants, a malformed renewal date, locale key availability, and that refresh invokes `refreshCurrentPlan` without generation. In a page test begin with one credit/no recap, let the mocked coordinator add the authoritative saved recap and set allowance to exhausted, and assert the saved text remains while generation disappears. Retain separate coordinator/store tests that verify the real post-success refresh.

Run the new page/component/completion suites, both existing AI suites, `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`, and `src/features/localization/__tests__/messages.test.ts`. No existing localized string is removed or reworded outside the touched recap flow.

## Task 5: Verify the integrated change and record evidence

**Files:** verify the mobile files above; update `weekly-us-api/AI_READINESS_REVIEW.md`, `weekly-us-api/AI_RELEASE_CHECKLIST.md`, this plan, and its linked design with actual results.

**Interfaces:** consumes completed Tasks 1-4; produces an evidence-backed implementation status, not a production release sign-off.

- [x] **Step 1: Format only changed runtime/test files and inspect the diff.** Use installed Prettier with an explicit list from the file map; do not run repo-wide `npm run format`. Check both repositories with `git diff --check`. Search the three entry points for `canUseFeature('aiSummary')` and `saveAiSummary`; no generation caller should retain either. Verify export gates, revision tests, and no new dependency/native/provider configuration changes.

- [x] **Step 2: Run full mobile verification from the mobile root.**

```powershell
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npm run build
npm run check
```

If `npm run check` stops at unrelated formatting errors, also run installed ESLint directly on the changed runtime/test files. Report remaining pre-existing errors separately, including any existing errors in touched files. Do not label explicit app TypeScript checking successful solely because the normal build passes. The `assistantRecap` missing-snapshot error must be gone; newly introduced errors are not acceptable baseline exclusions.

- [x] **Step 3: Record the actual outcomes.** Mark only verified AI-03/AI-04 checklist items complete, add test counts/commands and remaining manual checks to the design, and preserve all other findings. Backend runtime is unchanged, so skip backend runtime tests and state why. If implementation unexpectedly requires backend behavior changes, stop to reassess scope rather than silently broadening this plan.

- [x] **Step 4: Leave an explicit manual rollout checklist.** Free adult spends last credit and still reads/shares the result; Premium exhaustion/renewal and expiry preserve saved recaps; viewer cannot generate; unavailable allowance refresh recovers; offline finish retains completion; unauthorized/missing meeting exposes no recap; paid export remains gated. These require manual/device verification before release and must not be claimed from mocked tests alone.

## Plan self-review

- Contract and provider requirements map to Task 1; no credit defaults are added.
- Loading/failure/reset and response-order safety map to Task 2; all snapshot-writing async actions retain session guards.
- Success/exhaustion accounting refresh, failure preservation, and AI-02 protection map to Task 3.
- All three entry points, saved-result visibility/sharing, role-safe recovery copy, locale coverage, and export boundaries map to Task 4.
- Full verification, baseline reporting, and manual release limitations map to Task 5.
- Shared names are consistent: `AssistantRecapAllowance`, `assistantRecap`, `canGenerateAssistantRecap`, `isCheckingRecapAllowance`, `invalidateAssistantRecap`, `AiRecapUnavailableError`, `isRecapAllowanceExhausted`, and `RecapAllowanceStatus`.
- Implementation steps are complete; running a check is not a claim that its unrelated baseline passed. Documentation placement follows the user's corrected `docs/superpowers/` convention.

## Execution notes

- Completed inline using the test-first plan; the named execution skills were unavailable. No Git commits were made.
- Consolidated the two planned page-test files into `src/pages/__tests__/MeetingRecapPages.test.ts`, with shared `src/features/meeting/__tests__/recapFixtures.ts`. Both actual pages and the real export lock are tested.
- Review found that skipping a refresh during native billing could leave stale allowance. Added a failing regression, then `recapRefreshPending` so the existing billing action awaits the retained status refresh when it settles. This adds no background job or generation retry.
- Final mobile verification: 64 suites/520 tests passed; production build and targeted formatting passed. Explicit app typechecking and project-wide formatting retain their pre-existing baseline failures. Targeted lint retains only the pre-existing unused `meetingPreview` in the details page.
- No backend runtime checks were needed for documentation-only changes. No production/provider/native transaction, deployment, or device QA was performed.
