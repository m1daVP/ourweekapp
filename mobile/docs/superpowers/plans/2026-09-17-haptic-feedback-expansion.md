# Haptic Feedback Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add calm, semantic native haptic feedback for confirmed meeting/task/participant mutations, time-picker wheel changes, and every pull-to-refresh ready-zone crossing.

**Architecture:** Extend the existing `src/shared/services/hapticsService.ts` abstraction with semantic confirmation, removal, wheel-selection, and refresh-ready operations. Trigger mutation haptics only from successful user-confirmation paths; keep gesture-specific edge detection in `usePullToRefresh` and the time-picker component. Haptics remain guarded by Capacitor native-platform checks and never affect app behavior when unavailable.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia stores, Capacitor Haptics 8, Vitest, Vue Test Utils, Vite.

## Global Constraints

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Keep `src/shared/services/hapticsService.ts` as the only module importing `@capacitor/haptics`.
- Use semantic haptic methods rather than direct plugin calls in pages or feature components.
- Fire add/edit feedback only after the store mutation reports success.
- Fire remove feedback only after a confirmed delete/remove/disable succeeds.
- Do not add feedback for validation failures, canceled dialogs, navigation, intermediate field edits, undo/restore, or programmatic wheel positioning.
- Native haptic failures must be swallowed and must not block, roll back, or change visible app behavior.
- Browser execution must remain a no-op.
- Do not add dependencies, translation keys, backend changes, haptic settings, or native configuration.
- Preserve unrelated existing worktree changes and do not commit unless the user explicitly requests commits.

---

### Task 1: Extend the semantic haptics service

**Files:**

- Modify: `src/shared/services/hapticsService.ts`
- Modify: `src/shared/services/__tests__/hapticsService.test.ts`

**Interfaces:**

- Produces `haptics.remove(): Promise<void>` using `ImpactStyle.Medium`.
- Produces `haptics.refreshReady(): Promise<void>` using `ImpactStyle.Light`.
- Produces `haptics.wheelStart(): Promise<void>`, `haptics.wheelChange(): Promise<void>`, and `haptics.wheelEnd(): Promise<void>` using Capacitor selection APIs.
- Preserves `confirm()`, `completeMeeting()`, and `impact()` behavior for existing callers; migrate destructive callers to `remove()` in later tasks.

- [ ] **Step 1: Add failing service tests for the new semantic methods.**

  Extend the existing `@capacitor/haptics` mock with `selectionStart`, `selectionChanged`, and `selectionEnd`. Add tests that, on a native platform, assert:

  ```ts
  await haptics.remove();
  expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium });

  await haptics.refreshReady();
  expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });

  await haptics.wheelStart();
  await haptics.wheelChange();
  await haptics.wheelEnd();
  expect(Haptics.selectionStart).toHaveBeenCalledOnce();
  expect(Haptics.selectionChanged).toHaveBeenCalledOnce();
  expect(Haptics.selectionEnd).toHaveBeenCalledOnce();
  ```

  Also assert that browser execution skips all new plugin calls and that a rejected selection call resolves without throwing and calls `warnSafely` with the existing message.

- [ ] **Step 2: Run the focused service test to verify it fails.**

  Run:

  ```bash
  npm test -- src/shared/services/__tests__/hapticsService.test.ts
  ```

  Expected: FAIL because the new semantic methods are not defined.

- [ ] **Step 3: Implement the semantic methods through the existing native guard.**

  Add each method to the exported `haptics` object. Use `runNativeHaptic` for every plugin call:

  ```ts
  remove: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
  refreshReady: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  wheelStart: () => runNativeHaptic(() => Haptics.selectionStart()),
  wheelChange: () => runNativeHaptic(() => Haptics.selectionChanged()),
  wheelEnd: () => runNativeHaptic(() => Haptics.selectionEnd()),
  ```

  Keep `impact()` temporarily as a compatibility method until all existing destructive callers are migrated.

- [ ] **Step 4: Run the focused service test to verify it passes.**

  Run:

  ```bash
  npm test -- src/shared/services/__tests__/hapticsService.test.ts
  ```

  Expected: PASS.

### Task 2: Add repeated ready-zone feedback to pull-to-refresh

**Files:**

- Modify: `src/shared/composables/usePullToRefresh.ts`
- Modify: `src/shared/composables/__tests__/usePullToRefresh.test.ts`

**Interfaces:**

- Consumes `haptics.refreshReady()` from `@/shared/services/hapticsService`.
- Keeps `getPullToRefreshPhase(distance, refreshing)` unchanged.
- Produces a gesture state that emits once for each `pulling → ready` transition and re-arms after `ready → pulling`.

- [ ] **Step 1: Add a pure threshold-transition helper and failing tests.**

  Add an exported helper with this signature:

  ```ts
  export function shouldPulseOnPullReadyTransition(
    previousPhase: PullToRefreshPhase,
    nextPhase: PullToRefreshPhase
  ): boolean;
  ```

  Test these cases:

  ```ts
  expect(shouldPulseOnPullReadyTransition('pulling', 'ready')).toBe(true);
  expect(shouldPulseOnPullReadyTransition('ready', 'ready')).toBe(false);
  expect(shouldPulseOnPullReadyTransition('ready', 'pulling')).toBe(false);
  expect(shouldPulseOnPullReadyTransition('idle', 'ready')).toBe(true);
  expect(shouldPulseOnPullReadyTransition('refreshing', 'ready')).toBe(false);
  ```

- [ ] **Step 2: Run the focused pull-to-refresh test to verify it fails.**

  Run:

  ```bash
  npm test -- src/shared/composables/__tests__/usePullToRefresh.test.ts
  ```

  Expected: FAIL because the helper is not defined.

- [ ] **Step 3: Implement edge-triggered feedback in the composable.**

  Import `haptics`, implement the helper as `nextPhase === 'ready' && previousPhase !== 'ready' && previousPhase !== 'refreshing'`, and track the previous phase inside `handleTouchMove`.

  After assigning `pullDistance.value`, calculate the new phase and call `void haptics.refreshReady()` only when the helper returns true. Reset the previous phase in `resetGesture`, `finishPull`, the disabled watcher, and immediately before entering `isRefreshing` so a new gesture starts cleanly.

- [ ] **Step 4: Add an integration-style gesture test for repeated crossings.**

  Mock `haptics.refreshReady`, mount a minimal component using `usePullToRefresh` with a scrollable container ref, dispatch touch events that move above the threshold, below it, above it again, and release. Assert `refreshReady` was called twice and `onRefresh` once. Add a cancellation test asserting the next gesture can pulse again after `touchcancel`.

- [ ] **Step 5: Run pull-to-refresh tests.**

  Run:

  ```bash
  npm test -- src/shared/composables/__tests__/usePullToRefresh.test.ts
  ```

  Expected: PASS.

### Task 3: Add subtle value-change feedback to the time picker

**Files:**

- Modify: `src/shared/components/TimePickerField.vue`
- Create: `src/shared/components/__tests__/TimePickerField.test.ts`

**Interfaces:**

- Consumes `haptics.wheelStart()`, `haptics.wheelChange()`, and `haptics.wheelEnd()`.
- Keeps the public `modelValue`, `label`, `stepMinutes`, and `disabled` props and `update:modelValue` emit unchanged.
- Produces one `wheelChange()` call per distinct snapped hour/minute value during user scrolling.

- [ ] **Step 1: Create failing component tests for wheel feedback.**

  Mock `haptics` and `BaseDialog`. Mount the picker with `modelValue="09:00"`, open it, and assert opening causes no wheel haptic. Start a wheel interaction, set its `scrollTop` to the next option’s offset, dispatch `scroll`, and assert `wheelChange` was called once. Dispatch the same scroll again and assert it remains at one call. End the interaction and assert `wheelEnd` was called once. Repeat the value-change assertion for the minute wheel with a non-default `stepMinutes` such as `5`.

- [ ] **Step 2: Run the new component test to verify it fails.**

  Run:

  ```bash
  npm test -- src/shared/components/__tests__/TimePickerField.test.ts
  ```

  Expected: FAIL because the component does not call the new haptic methods.

- [ ] **Step 3: Implement explicit user-wheel interaction state.**

  Import `haptics`. Add a `wheelInteractionActive` ref or equivalent per-wheel interaction state. Add pointer/touch start and end handlers to each wheel:

  ```ts
  function startWheelInteraction() {
    if (!wheelInteractionActive.value) {
      wheelInteractionActive.value = true;
      void haptics.wheelStart();
    }
  }

  function endWheelInteraction() {
    if (wheelInteractionActive.value) {
      wheelInteractionActive.value = false;
      void haptics.wheelEnd();
    }
  }
  ```

  In `handleHourScroll` and `handleMinuteScroll`, calculate the snapped option first. Only when the snapped option differs from the current selection and the wheel is in an active user interaction should the handler update the selected value and call `void haptics.wheelChange()`.

- [ ] **Step 4: Keep programmatic positioning silent.**

  Add a short-lived `isApplyingWheelPosition` guard around `scrollWheel` and the `watch(isOpen)` positioning calls. The scroll handlers must update the selected value as needed but skip `wheelStart`, `wheelChange`, and `wheelEnd` while this guard is active. `selectHour` and `selectMinute` remain silent because they are button selection/programmatic positioning, not wheel scrolling.

- [ ] **Step 5: Run the time-picker tests.**

  Run:

  ```bash
  npm test -- src/shared/components/__tests__/TimePickerField.test.ts
  ```

  Expected: PASS.

### Task 4: Cover meeting add, edit-save, and delete confirmations

**Files:**

- Modify: `src/features/meeting/composables/useMeetingSession.ts`
- Modify: `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`
- Modify: `src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts`
- Modify: `src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts`

**Interfaces:**

- Consumes `haptics.confirm()` for successful meeting-item adds and edit saves.
- Consumes `haptics.confirm()` when a meeting guest participant is successfully added.
- Consumes `haptics.remove()` for successful note/task/agreement deletes.
- Keeps task completion and meeting completion haptics unchanged.

- [ ] **Step 1: Extend the existing haptics mocks and add failing assertions.**

  Add `confirm`, `remove`, and any already-used methods to the hoisted haptics mocks. In `useMeetingSession` tests, exercise the returned `addNote`, `addTask`, `addAgreement`, `saveNoteEdit`, `saveTaskEdit`, `saveAgreementEdit`, `deleteNote`, `deleteTask`, and `deleteAgreement` functions using valid fixture state. Assert successful adds/edits call `haptics.confirm` once and successful deletes call `haptics.remove` once. Assert invalid store results do not call either method.

- [ ] **Step 2: Run the focused meeting tests to verify they fail.**

  Run:

  ```bash
  npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts
  ```

  Expected: FAIL on the new haptic assertions.

- [ ] **Step 3: Add confirmation haptics at successful mutation boundaries.**

  In `useMeetingSession.ts`, add `void haptics.confirm()` after successful `updateNote`, `updateTaskDetails`, and `updateAgreement` calls, and after successful `addNote`. Add the same confirmation after adding either a selected drawer participant or a named guest. Keep the existing add-task/add-agreement and composer success calls, but ensure each successful confirmation path emits exactly once.

  Add `void haptics.remove()` immediately after each successful `deleteNote`, `deleteTask`, and `deleteAgreement` snapshot is obtained. Do not add feedback to `restoreDeleted*` functions.

- [ ] **Step 4: Migrate destructive meeting feedback to the semantic method and run tests.**

  Replace any meeting destructive use of `haptics.impact()` with `haptics.remove()`. Run the focused meeting tests again and expect PASS.

### Task 5: Normalize task-screen confirmation feedback

**Files:**

- Modify: `src/pages/TasksPage.vue`
- Modify: `src/pages/__tests__/TasksPage.test.ts`

**Interfaces:**

- Consumes `haptics.confirm()` for successful task add/edit-save.
- Consumes `haptics.remove()` for confirmed task delete.
- Preserves existing task-completion feedback and status-update behavior.

- [ ] **Step 1: Update the task-page haptics mock and add the semantic expectations.**

  Add a `remove` mock to the existing `TasksPage.test.ts` haptics mock. Change the delete expectation to `hapticRemove`, and add assertions that `saveTask` and `addTask` call `hapticConfirm` only after their store operations succeed. Keep the completion test asserting the existing light confirmation behavior.

- [ ] **Step 2: Run the task-page tests to verify the delete semantic assertion fails.**

  Run:

  ```bash
  npm test -- src/pages/__tests__/TasksPage.test.ts
  ```

  Expected: FAIL until the page uses `haptics.remove()`.

- [ ] **Step 3: Replace the destructive call and preserve success ordering.**

  Replace `void haptics.impact()` in `confirmDeleteTask` with `void haptics.remove()`. Keep `confirm()` calls after the successful `addTask` and `updateTask`/meeting mirror writes. Do not add feedback to permission failures, invalid title validation, or a failed `addTask` return.

- [ ] **Step 4: Run task-page tests.**

  Run:

  ```bash
  npm test -- src/pages/__tests__/TasksPage.test.ts
  ```

  Expected: PASS.

### Task 6: Add participant confirmation feedback

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

**Interfaces:**

- Consumes `haptics.confirm()` after successful participant create and edit-save.
- Consumes `haptics.remove()` after successful participant remove or disable.
- Leaves invitation/revocation and participant re-enable behavior unchanged unless it is part of an existing confirmed participant operation.

- [ ] **Step 1: Mock semantic haptics and add failing participant-flow assertions.**

  Add a haptics mock with `confirm` and `remove`. Extend the existing participant tests to submit a valid create form and assert one `confirm` call; edit a participant and submit the form, asserting one `confirm` call even when the duplicate group contains multiple records; remove an unused participant and assert one `remove` call; use a participant referenced by a task or agreement so the disable path runs and assert one `remove` call. Assert invalid empty-name submissions do not call haptics.

- [ ] **Step 2: Run participant tests to verify the new assertions fail.**

  Run:

  ```bash
  npm test -- src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
  ```

  Expected: FAIL on the new haptic assertions.

- [ ] **Step 3: Add one semantic call per successful confirmation.**

  Import `haptics`. In `saveParticipantDraft`, call `void haptics.confirm()` once after `createParticipant` returns a participant and once after `updatedParticipants.every(Boolean)` confirms the whole edit group succeeded; do not call once per duplicate record. In `hideOrRemoveParticipant`, call `void haptics.remove()` after either `disableParticipant` or `removeParticipant` succeeds. Keep all calls after validation and store success, before or alongside closing the sheet.

- [ ] **Step 4: Run participant tests.**

  Run:

  ```bash
  npm test -- src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
  ```

  Expected: PASS.

### Task 7: Run the complete verification suite

**Files:**

- No source changes planned unless a failing check identifies an implementation defect.

**Interfaces:**

- Verifies all semantic haptic methods are type-safe and all changed flows remain compatible with the existing app.

- [ ] **Step 1: Run all focused tests together.**

  Run:

  ```bash
  npm test -- src/shared/services/__tests__/hapticsService.test.ts src/shared/composables/__tests__/usePullToRefresh.test.ts src/shared/components/__tests__/TimePickerField.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/pages/__tests__/TasksPage.test.ts src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
  ```

  Expected: PASS.

- [ ] **Step 2: Run the production build.**

  Run:

  ```bash
  npm run build
  ```

  Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 3: Run formatting and lint checks.**

  Run:

  ```bash
  npm run check
  ```

  Expected: PASS for Prettier and ESLint.

- [ ] **Step 4: Review the final diff for scope.**

  Run:

  ```bash
  git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/shared/services/hapticsService.ts src/shared/composables/usePullToRefresh.ts src/shared/components/TimePickerField.vue src/features/meeting/composables/useMeetingSession.ts src/pages/TasksPage.vue src/features/participants/components/HouseholdMembersSettings.vue
  ```

  Confirm that only the requested haptic behavior and its tests changed, and that unrelated existing worktree changes remain untouched.
