# Task Swipe Haptic Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a light haptic pulse whenever a Tasks-page card swipe reaches its finish or delete action threshold, re-arming after the card moves back below it.

**Architecture:** Add a pure boolean-transition helper next to the existing task-swipe utilities. `TaskSwipeActionCard.vue` keeps a local readiness latch, updates it after every accepted horizontal pointer move, and calls the existing `haptics.refreshReady()` method only for unready-to-ready transitions. This preserves the current action threshold, visual state, and finish/delete emits.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, Capacitor Haptics service.

## Global Constraints

- Apply the behavior to both right-to-finish and left-to-delete task-card swipes.
- Use the existing light `haptics.refreshReady()` method; do not import Capacitor Haptics outside `src/shared/services/hapticsService.ts`.
- Keep `TASK_SWIPE_THRESHOLD_RATIO`, gesture intent rules, clamping, visual readiness states, and emitted actions unchanged.
- Send one pulse per threshold crossing; re-arm below the threshold, when switching through neutral to the opposite direction, and on drag reset.
- Do not pulse on below-threshold, vertical, or disabled-direction movement.
- A cancellation after a crossing keeps its already-sent pulse but clears the latch; a cancellation before crossing is silent.
- Do not add dependencies, native configuration, user-facing copy, or settings.
- Preserve unrelated working-tree changes. Do not stage or commit unless the user explicitly requests it.

---

### Task 1: Make threshold crossings independently testable

**Files:**

- Modify: `src/features/tasks/taskSwipeActions.ts:1-34`
- Test: `src/features/tasks/__tests__/taskSwipeActions.test.ts:1-41`

**Interfaces:**

- Consumes: the component's prior and current aggregate action-ready states as booleans.
- Produces: `shouldPulseOnTaskSwipeReadyTransition(wasReady: boolean, isReady: boolean): boolean`.
- The function returns `true` only when the current move enters readiness from a non-ready state.

- [x] **Step 1: Write the failing transition tests.**

  Import `shouldPulseOnTaskSwipeReadyTransition` and add a focused test that covers enter, hold, exit, and re-enter:

  ```ts
  it('pulses only when a swipe enters action readiness', () => {
    expect(shouldPulseOnTaskSwipeReadyTransition(false, false)).toBe(false);
    expect(shouldPulseOnTaskSwipeReadyTransition(false, true)).toBe(true);
    expect(shouldPulseOnTaskSwipeReadyTransition(true, true)).toBe(false);
    expect(shouldPulseOnTaskSwipeReadyTransition(true, false)).toBe(false);
    expect(shouldPulseOnTaskSwipeReadyTransition(false, true)).toBe(true);
  });
  ```

- [x] **Step 2: Run the utility test to verify the regression.**

  Run:

  ```bash
  npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts
  ```

  Expected: FAIL because `shouldPulseOnTaskSwipeReadyTransition` is not exported.

- [x] **Step 3: Add the minimal pure transition helper.**

  Append this export to `taskSwipeActions.ts`:

  ```ts
  export function shouldPulseOnTaskSwipeReadyTransition(
    wasReady: boolean,
    isReady: boolean
  ) {
    return !wasReady && isReady;
  }
  ```

- [x] **Step 4: Re-run the utility test.**

  Run:

  ```bash
  npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts
  ```

  Expected: PASS.

### Task 2: Pulse task-card swipe threshold crossings

**Files:**

- Modify: `src/features/tasks/components/TaskSwipeActionCard.vue:1-179`
- Test: `src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts:1-89`

**Interfaces:**

- Consumes: `shouldPulseOnTaskSwipeReadyTransition`, `haptics.refreshReady(): Promise<void>`, `isFinishReady`, and `isDeleteReady`.
- Produces: one `haptics.refreshReady()` call per accepted transition from not-ready to finish-ready or delete-ready.
- Preserves: `finish`, `requestDelete`, `open`, and `toggleStatus` emits and the existing task-card props.

- [x] **Step 1: Add failing component tests with a mocked haptics service.**

  Add a hoisted mock before importing the component:

  ```ts
  const haptics = vi.hoisted(() => ({ refreshReady: vi.fn() }));

  vi.mock('@/shared/services/hapticsService', () => ({ haptics }));
  ```

  Split the current `swipe` helper into `startSwipe`, `moveSwipe`, and `endSwipe`, retaining the 200px mocked width. Add these assertions:

  ```ts
  await startSwipe(wrapper, 0);
  await moveSwipe(wrapper, 50);
  await moveSwipe(wrapper, 90);
  await moveSwipe(wrapper, 49);
  await moveSwipe(wrapper, 50);
  expect(haptics.refreshReady).toHaveBeenCalledTimes(2);
  ```

  Add an equivalent leftward sequence using `startSwipe(wrapper, 200)` and moves to `150`, `110`, `151`, and `150`. Add a below-threshold and vertical-gesture test that expects no calls. Add a cancelled-before-threshold test that starts a drag, moves to 49px, sends `pointercancel`, then starts a new drag and verifies its first crossing produces exactly one pulse.

- [x] **Step 2: Run the component test to verify the regression.**

  Run:

  ```bash
  npx vitest run src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts
  ```

  Expected: FAIL because the component does not call `haptics.refreshReady()`.

- [x] **Step 3: Track readiness and notify only on crossings.**

  In `TaskSwipeActionCard.vue`, import the helper and haptics service:

  ```ts
  import { haptics } from '@/shared/services/hapticsService';
  import {
    clampTaskSwipeOffset,
    hasReachedTaskSwipeThreshold,
    isHorizontalTaskSwipe,
    shouldPulseOnTaskSwipeReadyTransition,
    shouldSuppressClickAfterTaskSwipe,
    TASK_SWIPE_INTENT_PX,
  } from '@/features/tasks/taskSwipeActions';
  ```

  Add `const wasActionReady = ref(false);`, reset it in `resetSwipe()`, and add this local function:

  ```ts
  function updateActionReadyFeedback() {
    const isActionReady = isFinishReady.value || isDeleteReady.value;

    if (
      shouldPulseOnTaskSwipeReadyTransition(wasActionReady.value, isActionReady)
    ) {
      void haptics.refreshReady();
    }

    wasActionReady.value = isActionReady;
  }
  ```

  Call `updateActionReadyFeedback()` immediately after assigning `offsetX.value` in `handlePointerMove`. Do not call it before horizontal swipe intent is established or from pointer end/cancel handlers.

- [x] **Step 4: Run the task swipe tests.**

  Run:

  ```bash
  npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts
  ```

  Expected: PASS. Finish and delete emits retain their existing threshold behavior.

### Task 3: Validate the mobile interaction change

**Files:**

- Verify: `src/features/tasks/components/TaskSwipeActionCard.vue`
- Verify: `src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts`

**Interfaces:**

- Verifies the implementation is type-safe, formatted, and does not introduce visual or accessibility regressions.

- [x] **Step 1: Run the production build.**

  Run:

  ```bash
  npm run build
  ```

  Expected: PASS with no TypeScript or Vite errors.

- [x] **Step 2: Run scoped format and lint checks.**

  Run:

  ```bash
  npx prettier --check src/features/tasks/taskSwipeActions.ts src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/TaskSwipeActionCard.vue src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts
  npx eslint src/features/tasks/taskSwipeActions.ts src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/TaskSwipeActionCard.vue src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts
  ```

  Expected: PASS.

- [x] **Step 3: Run the UI detector and review the scoped diff.**

  Run:

  ```bash
  .agents/skills/impeccable/scripts/impeccable.cmd detect --json src/features/tasks/components/TaskSwipeActionCard.vue
  git diff -- src/features/tasks/taskSwipeActions.ts src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/TaskSwipeActionCard.vue src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts
  ```

  Expected: the detector reports no relevant issues, and the diff adds only threshold-crossing haptic behavior and regression coverage.

**Verification note:** `npm run check` was attempted but its repository-wide Prettier scan is blocked by unrelated tooling and workspace files. The changed task-swipe files pass scoped Prettier and ESLint checks.
