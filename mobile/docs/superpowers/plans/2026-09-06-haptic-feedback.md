# Haptic Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained, best-effort native haptic confirmations to meaningful completed actions in OurWeek.

**Architecture:** A shared `hapticsService` owns the Capacitor plugin and exposes semantic feedback methods. It is a no-op outside native Capacitor, catches plugin failures, and is called only after the originating store operation has succeeded. Meeting and task flows consume the service at their existing success boundaries; no haptic state is added to Pinia.

**Tech Stack:** Vue 3 Composition API, TypeScript, Capacitor 8, `@capacitor/haptics`, Vitest, Vue Test Utils.

## Global Constraints

- Use npm only and add Capacitor Haptics at a version compatible with the installed Capacitor `8.5.0` packages.
- Keep `@capacitor/haptics` usage inside `src/shared/services/hapticsService.ts`; pages and composables import only the shared service.
- Use `<script setup lang="ts">`, explicit TypeScript types, and the existing `@` import alias.
- The service must be a no-op in browser development and must never block, fail, or change a successful user flow.
- Do not add an in-app haptic setting; native device/system haptic settings remain authoritative.
- Trigger feedback only after success for task completion, task/agreement save, meeting start/finish, and confirmed deletion. Do not add feedback to navigation, typing, validation, loading, or background sync.
- Maintain OurWeek’s calm, non-gamified mobile experience. Browser behavior remains unchanged.
- Do not create Git commits unless the user explicitly requests them.

---

## File structure

- `package.json` and `package-lock.json`: declare and lock the Capacitor-native haptics plugin.
- `src/shared/services/hapticsService.ts`: the sole platform boundary and semantic haptic API.
- `src/shared/services/__tests__/hapticsService.test.ts`: native, browser, and rejected-plugin service behavior.
- `src/features/meeting/composables/useMeetingSession.ts`: haptics for check-in start, in-meeting task/agreement saves, finished meetings, and confirmed draft deletion.
- `src/pages/MeetingTemplatesPage.vue`: haptic after a new meeting has been created successfully.
- `src/pages/TasksPage.vue`: haptics after task save/create, completed status persistence, and confirmed task deletion.
- `src/pages/HistoryPage.vue`, `src/pages/PrivateNotesPage.vue`, and `src/pages/AccountPage.vue`: haptics after each existing confirmed deletion succeeds.
- Existing focused tests near those flows: verify haptic calls are made only at success boundaries without duplicating native-plugin tests.

### Task 1: Add and isolate the native haptics capability

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/shared/services/hapticsService.ts`
- Create: `src/shared/services/__tests__/hapticsService.test.ts`

**Interfaces:**

- Consumes: `Capacitor.isNativePlatform()` from `@capacitor/core`, `Haptics.impact()` and `Haptics.notification()` from `@capacitor/haptics`, and `warnSafely()` from `@/shared/services/safeLogService`.
- Produces: `haptics.confirm(): Promise<void>`, `haptics.completeMeeting(): Promise<void>`, and `haptics.impact(): Promise<void>`.

- [ ] **Step 1: Add the compatible official plugin dependency**

Run:

```powershell
npm install @capacitor/haptics@8
```

Expected: `package.json` records `"@capacitor/haptics": "8.x.x"` under `dependencies`, the lockfile is updated, and the installed major version matches Capacitor 8.

- [ ] **Step 2: Write failing service tests for platform gating and error handling**

Create `src/shared/services/__tests__/hapticsService.test.ts` with static mocks and reset them before each test:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { haptics } from '@/shared/services/hapticsService';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn(), notification: vi.fn() },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
  NotificationType: { Success: 'SUCCESS' },
}));
vi.mock('@/shared/services/safeLogService', () => ({ warnSafely: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('does nothing in the browser', async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  await haptics.confirm();
  expect(Haptics.impact).not.toHaveBeenCalled();
  expect(Haptics.notification).not.toHaveBeenCalled();
});

it('uses a light impact for an ordinary confirmation', async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  await haptics.confirm();
  expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
});

it('uses a success notification for a completed meeting', async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  await haptics.completeMeeting();
  expect(Haptics.notification).toHaveBeenCalledWith({
    type: NotificationType.Success,
  });
});

it('absorbs native plugin failures', async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  vi.mocked(Haptics.impact).mockRejectedValueOnce(new Error('unavailable'));
  await expect(haptics.confirm()).resolves.toBeUndefined();
});
```

- [ ] **Step 3: Run the new test to verify it fails before implementation**

Run:

```powershell
npx vitest run src/shared/services/__tests__/hapticsService.test.ts
```

Expected: FAIL because `@/shared/services/hapticsService` does not exist.

- [ ] **Step 4: Implement the semantic, best-effort service**

Create `src/shared/services/hapticsService.ts`:

```ts
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { warnSafely } from '@/shared/services/safeLogService';

async function runNativeHaptic(action: () => Promise<void>) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await action();
  } catch (error) {
    warnSafely('Unable to provide haptic feedback.', error);
  }
}

export const haptics = {
  confirm: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  completeMeeting: () =>
    runNativeHaptic(() =>
      Haptics.notification({ type: NotificationType.Success })
    ),
  impact: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
};
```

Keep calls intentionally fire-and-forget at feature boundaries (`void haptics.confirm()`), since feedback cannot delay a completed action.

- [ ] **Step 5: Run service tests and type/lint checks**

Run:

```powershell
npx vitest run src/shared/services/__tests__/hapticsService.test.ts
npm run check
```

Expected: PASS. Service calls are native-only, and an unavailable plugin is swallowed after safe diagnostic logging.

### Task 2: Add feedback to core meeting actions after their stores succeed

**Files:**

- Modify: `src/features/meeting/composables/useMeetingSession.ts:25-26,925-955,994-1024,1128-1141,1197-1268,1312-1330`
- Modify: `src/pages/MeetingTemplatesPage.vue:5-15,69-88`
- Modify: `src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts`
- Create: `src/features/meeting/composables/__tests__/meetingHaptics.test.ts`
- Create: `src/pages/__tests__/MeetingTemplatesPage.test.ts`

**Interfaces:**

- Consumes: `haptics.confirm()`, `haptics.completeMeeting()`, and `haptics.impact()` from Task 1.
- Produces: haptic calls only after the existing meeting store calls report success; no new public component API.

- [ ] **Step 1: Add failing unit tests for meeting success boundaries**

Mock the service with `vi.mock('@/shared/services/hapticsService', () => ({ haptics: { confirm: vi.fn(), completeMeeting: vi.fn(), impact: vi.fn() } }))`.

In `meetingHaptics.test.ts`, mount `useMeetingSession` with the existing meeting fixture setup and assert:

```ts
expect(haptics.confirm).toHaveBeenCalledTimes(1); // after addTask success
expect(haptics.confirm).toHaveBeenCalledTimes(1); // after addAgreement success
expect(haptics.confirm).toHaveBeenCalledTimes(1); // after startRitual success
expect(haptics.impact).toHaveBeenCalledTimes(1); // after deleteDraftMeeting returns true
```

For each matching store failure (an add error or `deleteDraftMeeting` returning `false`), assert `expect(haptics.confirm).not.toHaveBeenCalled()` or `expect(haptics.impact).not.toHaveBeenCalled()`.

Extend `meetingRecapCompletion.test.ts` to assert that successful `finishMeeting()` calls `haptics.completeMeeting()` once before/while routing, and that the viewer/failure case which leaves the meeting in progress never calls it.

Create `MeetingTemplatesPage.test.ts` with mocked stores and router; invoke `startSelectedTemplate()` through its primary CTA and assert `haptics.confirm()` occurs after `startNewMeetingFromTemplate()` and not when the template is locked or permission is denied.

- [ ] **Step 2: Run focused meeting tests to verify they fail**

Run:

```powershell
npx vitest run src/features/meeting/composables/__tests__/meetingHaptics.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingTemplatesPage.test.ts
```

Expected: FAIL because the core meeting flows do not import or invoke `haptics`.

- [ ] **Step 3: Call the semantic service at existing successful outcomes**

In `useMeetingSession.ts`, import the service and add exactly these non-blocking calls:

```ts
// Directly after each successful existing state change.
void haptics.confirm(); // addTask, addAgreement, startRitual
void haptics.completeMeeting(); // after meetingsStore.finishMeeting() returns no error
void haptics.impact(); // after deleteDraftMeeting(meeting.id) returns true
```

Place `completeMeeting()` immediately after the successful `meetingsStore.finishMeeting()` result and before the optional AI recap. This makes successful completion feel complete even when the optional recap is unavailable, while no error path emits feedback.

In `MeetingTemplatesPage.vue`, import the service and call `void haptics.confirm()` after `startNewMeetingFromTemplate()` and task synchronization, immediately before navigation. Do not call it in `resumeDraft()`, locked-template upgrade routing, or permission-error paths.

- [ ] **Step 4: Run focused meeting tests to verify the new behavior**

Run:

```powershell
npx vitest run src/features/meeting/composables/__tests__/meetingHaptics.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingTemplatesPage.test.ts
```

Expected: PASS. Every tested cue follows a successful state transition, and no feedback is produced for denied, failed, or non-start navigation paths.

### Task 3: Add feedback to task outcomes and confirmed deletion outcomes

**Files:**

- Modify: `src/pages/TasksPage.vue:1-22,400-594`
- Modify: `src/pages/HistoryPage.vue:1-17,135-150`
- Modify: `src/pages/PrivateNotesPage.vue:1-12,64-124`
- Modify: `src/pages/AccountPage.vue:1-20,148-180`
- Modify: `src/pages/__tests__/TasksPage.test.ts`
- Create: `src/pages/__tests__/confirmedDeletionHaptics.test.ts`

**Interfaces:**

- Consumes: `haptics.confirm()` and `haptics.impact()` from Task 1.
- Produces: feedback after saved/created tasks, persisted task completion, and confirmed deletion actions; no changed component props or emitted events.

- [ ] **Step 1: Add failing task and deletion-flow tests**

Extend `TasksPage.test.ts` with the shared haptics mock. Assert that its current completion-flow test calls `haptics.confirm()` only after advancing the 720ms timer that persists `done`, not when the animation begins. Add one success case for `addTask()` and one for task detail save; each should call `haptics.confirm()` after its store update succeeds. Add a `confirmDeleteTask()` case that calls `haptics.impact()` after both existing store deletions execute.

Create `confirmedDeletionHaptics.test.ts` using small component mounts and mocked stores for the pages’ existing confirm handlers:

```ts
expect(haptics.impact).toHaveBeenCalledTimes(1); // HistoryPage: deleteDraftMeeting returned true
expect(haptics.impact).toHaveBeenCalledTimes(1); // PrivateNotesPage: deleteNote completed
expect(haptics.impact).toHaveBeenCalledTimes(1); // AccountPage: account deletion completed successfully
```

For HistoryPage, mock `deleteDraftMeeting` to return `false` and verify no haptic call. For AccountPage, mock the async deletion service to reject and verify no haptic call plus the page’s existing safe error state. Do not add haptics to cancel actions, dialog opens, Calendar disconnect, logout, or end-session-with-draft flows.

- [ ] **Step 2: Run focused task and deletion tests to verify they fail**

Run:

```powershell
npx vitest run src/pages/__tests__/TasksPage.test.ts src/pages/__tests__/confirmedDeletionHaptics.test.ts
```

Expected: FAIL because these pages do not yet invoke `haptics`.

- [ ] **Step 3: Add fire-and-forget calls only after the current successful actions**

Make these exact boundary changes:

```ts
// TasksPage.vue
void haptics.confirm(); // after updateTask/addTask has succeeded
void haptics.confirm(); // after both task status stores are updated to 'done'
void haptics.impact(); // after confirmed task deletion is complete

// HistoryPage.vue
void haptics.impact(); // inside `if (wasDeleted)` before/after existing toast

// PrivateNotesPage.vue
void haptics.impact(); // after privateNotesStore.deleteNote(note.id)

// AccountPage.vue
void haptics.impact(); // only after the awaited account deletion succeeds
```

In `TasksPage.vue`, the completed-task confirmation belongs inside the existing delayed persistence callback, directly after both `updateTaskStatus(..., 'done')` calls. It must not run when a task is reopened, skipped, rejected for permissions, or only visually animating.

- [ ] **Step 4: Run focused tests to verify all task and deletion cases pass**

Run:

```powershell
npx vitest run src/pages/__tests__/TasksPage.test.ts src/pages/__tests__/confirmedDeletionHaptics.test.ts
```

Expected: PASS. Haptics occur once for each completed save/delete action and never for failure, cancellation, validation, or visual-only states.

### Task 4: Full regression and native verification

**Files:**

- Modify only if an earlier test or formatting run identifies a concrete issue.

**Interfaces:**

- Consumes: all completed Tasks 1–3.
- Produces: a verified web build and Android-synced native haptics implementation.

- [ ] **Step 1: Run all automated quality gates**

Run:

```powershell
npm test
npm run build
npm run check
```

Expected: all tests, type checking, production bundle generation, Prettier verification, and ESLint pass.

- [ ] **Step 2: Sync the Android project**

Run:

```powershell
npm run cap:sync
```

Expected: the new haptics plugin is registered/synchronized into the Android native project without build errors.

- [ ] **Step 3: Verify on a physical Android device**

Check the following manually:

```text
1. Creating a meeting, starting its check-in, adding a task/agreement, completing a task, and finishing the meeting each yields one subtle cue.
2. Deleting a task, draft meeting, private note, and account after confirming yields a slightly firmer cue only after deletion succeeds.
3. Navigating tabs/pages, opening sheets/dialogs, entering text, validation errors, and background refresh cause no vibration.
4. With device haptics disabled or unavailable, every flow still completes and shows its existing visual/toast feedback.
```

- [ ] **Step 4: Review the final diff before handoff**

Run:

```powershell
git diff --check
git diff -- package.json package-lock.json src/shared/services/hapticsService.ts src/shared/services/__tests__/hapticsService.test.ts src/features/meeting/composables/useMeetingSession.ts src/pages/MeetingTemplatesPage.vue src/pages/TasksPage.vue src/pages/HistoryPage.vue src/pages/PrivateNotesPage.vue src/pages/AccountPage.vue
```

Expected: no whitespace errors, no unrelated changes, no direct `@capacitor/haptics` imports outside the shared service, and no accidental haptic calls on routine interactions.

## Plan self-review

- **Spec coverage:** Task 1 covers the isolated native/browser-safe architecture and plugin failures. Task 2 covers meeting start, task/agreement save, meeting completion, and meeting deletion. Task 3 covers standalone task outcomes plus all confirmed data-deletion pages. Task 4 covers required automated and Android verification. Routine interaction exclusions and no separate setting are recorded in global constraints and verified manually.
- **Completeness scan:** The document contains concrete steps, commands, and interfaces for every planned change. The `impact()` method is explicitly assigned to confirmed destructive actions.
- **Type consistency:** Every integration uses the same `haptics.confirm()`, `haptics.completeMeeting()`, and `haptics.impact()` service interface defined in Task 1.
