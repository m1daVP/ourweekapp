# Task Swipe Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users finish an open task by swiping right and request task removal by swiping left at 25% of card width.

**Architecture:** A task-feature swipe utility defines bidirectional threshold, clamping, gesture intent, and click-suppression rules. `TaskSwipeActionCard` owns pointer handling and visual underlays, while `TasksPage` remains responsible for task completion, permissions, and the existing deletion confirmation.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue Test Utils, Vitest, scoped task feature components, global CSS tokens in `src/styles/main.css`.

## Global Constraints

- Support mobile touch and pointer input without interfering with vertical scrolling.
- The finish threshold and remove threshold are exactly 25% of the rendered card width.
- Finish applies only to an editable open task; remove opens confirmation and never deletes immediately.
- Preserve semantic, focusable controls; gestures are an enhancement, not the only interaction path.
- Use transform and opacity only for gesture feedback and respect reduced-motion preferences.
- Do not add dependencies or modify task persistence or API DTOs.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Define and test bidirectional task-swipe rules

**Files:**

- Create: `src/features/tasks/taskSwipeActions.ts`
- Create: `src/features/tasks/__tests__/taskSwipeActions.test.ts`

**Interfaces:**

- Produces: `TASK_SWIPE_THRESHOLD_RATIO`, `TASK_SWIPE_INTENT_PX`, `clampTaskSwipeOffset(deltaX, width, canFinish)`, `hasReachedTaskSwipeThreshold(offsetX, width)`, `isHorizontalTaskSwipe(deltaX, deltaY)`, and `shouldSuppressClickAfterTaskSwipe(maxOffsetX)`.
- Consumed by: `TaskSwipeActionCard.vue` in Task 2.

- [x] **Step 1: Write failing utility tests**

```ts
import {
  clampTaskSwipeOffset,
  hasReachedTaskSwipeThreshold,
} from '@/features/tasks/taskSwipeActions';

it('reaches each action threshold at one quarter of the card width', () => {
  expect(hasReachedTaskSwipeThreshold(49, 200)).toBe(false);
  expect(hasReachedTaskSwipeThreshold(50, 200)).toBe(true);
  expect(hasReachedTaskSwipeThreshold(-50, 200)).toBe(true);
});

it('blocks a finish-direction drag for a completed task', () => {
  expect(clampTaskSwipeOffset(72, 200, false)).toBe(0);
  expect(clampTaskSwipeOffset(-72, 200, false)).toBe(-72);
});
```

Also test horizontal intent in both directions, vertical-motion rejection, clamping to the card bounds, and suppressing a click after an 8px-or-larger drag.

- [x] **Step 2: Run the new utility test**

Run: `npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the pure swipe helper**

```ts
export const TASK_SWIPE_THRESHOLD_RATIO = 0.25;
export const TASK_SWIPE_INTENT_PX = 8;

export function clampTaskSwipeOffset(
  deltaX: number,
  width: number,
  canFinish: boolean
) {
  if (width <= 0) return 0;
  const minOffset = -width;
  const maxOffset = canFinish ? width : 0;
  return Math.max(minOffset, Math.min(maxOffset, deltaX));
}
```

Implement the remaining helpers with the same 8px horizontal-intent rule used by the meeting-history swipe behavior, and with `Math.abs(offsetX) >= width * TASK_SWIPE_THRESHOLD_RATIO` for the threshold.

- [x] **Step 4: Re-run the utility test**

Run: `npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts`

Expected: PASS.

### Task 2: Build the accessible swipeable task-card component

**Files:**

- Create: `src/features/tasks/components/TaskSwipeActionCard.vue`
- Create: `src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts`
- Modify: `src/styles/main.css:3950-4145, 4270-4288`

**Interfaces:**

- Consumes: Task swipe helpers from Task 1 and task-card display values passed as typed props.
- Produces: `open`, `toggleStatus`, `finish`, and `requestDelete` events for `TasksPage`.

- [x] **Step 1: Write failing component interaction tests**

Use the happy-dom environment, stub `ParticipantAvatar`, mock the card element width as 200px, and dispatch pointer events through the card surface.

```ts
it('emits finish after a 50px right swipe for an open task', async () => {
  const wrapper = mountCard({ status: 'open', canFinish: true });

  await swipe(wrapper, { startX: 0, endX: 50, width: 200 });

  expect(wrapper.emitted('finish')).toHaveLength(1);
});

it('requests deletion after a 50px left swipe without deleting directly', async () => {
  const wrapper = mountCard({ status: 'done', canFinish: false });

  await swipe(wrapper, { startX: 100, endX: 50, width: 200 });

  expect(wrapper.emitted('requestDelete')).toHaveLength(1);
  expect(wrapper.emitted('finish')).toBeUndefined();
});
```

Also test that a sub-threshold drag emits neither action, a completed task ignores a right swipe, and the visible Remove button emits `requestDelete`.

- [x] **Step 2: Run the component test**

Run: `npx vitest run src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts`

Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement `TaskSwipeActionCard.vue`**

Define typed props for the existing task-card display model and action permissions. Track `offsetX`, `cardWidth`, pointer identity, start coordinates, horizontal-drag state, and click suppression. On pointer release, emit `finish` for a positive threshold only when `canFinish` is true; emit `requestDelete` for a negative threshold only when `canRemove` is true; then reset the card.

```ts
const finishReady = computed(
  () =>
    offsetX.value > 0 &&
    hasReachedTaskSwipeThreshold(offsetX.value, cardWidth.value)
);
const deleteReady = computed(
  () =>
    offsetX.value < 0 &&
    hasReachedTaskSwipeThreshold(offsetX.value, cardWidth.value)
);

if (finishReady.value) emit('finish');
if (deleteReady.value) emit('requestDelete');
```

Render a green left underlay with Finish and a red right underlay with Remove. Keep the card's completion button and content button, add a focusable Remove button that emits the confirmation request, and mark underlays `aria-hidden="true"`.

- [x] **Step 4: Add mobile-safe styles**

Create a clipping swipe frame and transform the surface with `translateX`. Use green/red underlays anchored to opposite edges, reveal labels as their direction is dragged, set `touch-action: pan-y` on the surface, and provide reduced-motion overrides alongside existing task-card reduced-motion styles.

```css
.task-swipe-card__surface {
  touch-action: pan-y;
  transform: translateX(var(--task-swipe-offset, 0));
}

.task-swipe-card.is-finish-ready .task-swipe-card__finish-underlay,
.task-swipe-card.is-delete-ready .task-swipe-card__delete-underlay {
  opacity: 1;
}
```

- [x] **Step 5: Re-run the component test**

Run: `npx vitest run src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts`

Expected: PASS.

### Task 3: Integrate swipe cards into both Tasks-page sections

**Files:**

- Modify: `src/pages/TasksPage.vue:12-50, 646-785`
- Modify: `src/pages/__tests__/TasksPage.test.ts`

**Interfaces:**

- Consumes: `TaskSwipeActionCard` and its `open`, `toggleStatus`, `finish`, and `requestDelete` events.
- Produces: the same tasks page behavior, with additional swipe action entry points.

- [x] **Step 1: Write failing integration tests**

Extend the Tasks page test to stub `TaskSwipeActionCard` as an emitting component and assert event wiring.

```ts
await wrapper.findComponent(TaskSwipeActionCard).vm.$emit('finish');
expect(state.updateTaskStatus).toHaveBeenCalledWith('task-1', 'done');

await wrapper.findComponent(TaskSwipeActionCard).vm.$emit('requestDelete');
expect(wrapper.text()).toContain('tasksPage.deleteTask');
```

Add a completed-task fixture and assert its swipe-card props set `canFinish` to `false`.

- [x] **Step 2: Run the page test**

Run: `npx vitest run src/pages/__tests__/TasksPage.test.ts`

Expected: FAIL because the swipe-card component is not integrated.

- [x] **Step 3: Replace duplicated card markup with `TaskSwipeActionCard`**

Import the component and render it in both `sharedTaskCards` and `myTaskCards` loops. Pass the current card display values and permission state. Wire events without changing parent business logic:

```vue
<TaskSwipeActionCard
  :status="card.task.status"
  :can-finish="canEditTasks && card.task.status === 'open'"
  :can-remove="canDeleteTasks"
  @open="openTask(card)"
  @toggle-status="toggleTaskStatus(card)"
  @finish="setTaskStatus(card.task, 'done')"
  @request-delete="deleteTask(card.task)"
/>
```

Ensure finish uses `setTaskStatus` so the existing completion animation and status feedback remain authoritative, and removal uses `deleteTask` so the existing confirmation dialog remains mandatory.

- [x] **Step 4: Run focused verification**

Run: `npx vitest run src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts src/pages/__tests__/TasksPage.test.ts src/app/stores/__tests__/tasks.test.ts src/app/stores/__tests__/meetings.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npx eslint src/features/tasks/taskSwipeActions.ts src/features/tasks/components/TaskSwipeActionCard.vue src/pages/TasksPage.vue src/features/tasks/__tests__/taskSwipeActions.test.ts src/features/tasks/components/__tests__/TaskSwipeActionCard.test.ts src/pages/__tests__/TasksPage.test.ts`

Expected: PASS.
