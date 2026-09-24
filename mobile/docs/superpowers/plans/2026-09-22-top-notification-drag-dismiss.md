# Top Notification Drag-Dismiss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a top in-app notification follow a valid upward drag and dismiss instantly at a 15px threshold.

**Architecture:** Keep the pointer state and live drag offset local to `AppShell.vue`, where the notification is rendered. A CSS custom property augments the notification’s existing centered transform, while a dragging modifier temporarily removes transition lag. No pull-to-refresh markup, listeners, or state changes.

**Tech Stack:** Vue 3 Composition API, TypeScript, CSS, Vitest, Vue Test Utils.

## Global Constraints

- Do not alter existing pull-to-refresh markup, pointer handlers, or behavior.
- Move the notification only for a vertically dominant upward drag; never below its rest position.
- Dismiss immediately when the live upward drag reaches 15px.
- Reset a short, downward, sideways, released, or cancelled drag to rest.
- Set `touch-action: none` on the notification so its touch gesture is not converted into browser scrolling.
- Do not add dependencies or commit changes unless the user explicitly asks.

---

### Task 1: Add a responsive notification drag gesture

**Files:**

- Modify: `src/shared/components/AppShell.vue:35-170, 268-287`
- Modify: `src/shared/components/__tests__/AppShell.test.ts:145-195`

**Interfaces:**

- Consumes: `dismissInAppNotification(): void` from `useInAppNotification()`.
- Produces: `handleInAppNotificationPointerDown(event: PointerEvent): void`, `handleInAppNotificationPointerMove(event: PointerEvent): void`, and reset handlers for pointer release, cancellation, and lost capture.

- [x] **Step 1: Write failing rendered-gesture tests**

  In `AppShell.test.ts`, drive pointer events on `.in-app-notification` and assert its rendered inline custom property updates during an upward drag:

  ```ts
  await notification.trigger('pointerdown', {
    clientX: 20,
    clientY: 180,
    pointerId: 1,
  });
  await notification.trigger('pointermove', {
    clientX: 20,
    clientY: 170,
    pointerId: 1,
  });

  expect(notification.attributes('style')).toContain(
    '--in-app-notification-drag-offset: -10px'
  );
  ```

  Add cases that a 15px `pointermove` calls `dismissInAppNotification` without a `pointerup`, and that downward, sideways, short-release, cancellation, and lost capture restore the custom property to `0px` without dismissal.

- [x] **Step 2: Run the focused test to verify it fails**

  Run:

  ```powershell
  npm exec vitest -- run src/shared/components/__tests__/AppShell.test.ts
  ```

  Expected: new live-drag and 15px-dismiss assertions fail because no pointer-move state or visual offset exists.

- [x] **Step 3: Implement local drag state and event handlers**

  In `AppShell.vue`, store the active pointer id, initial coordinates, a negative-or-zero drag offset, and whether the notification is being dragged. On pointer move, calculate `clientY - startY`; set the offset only when it is negative and vertically dominant. When `-offset >= 15`, reset local gesture state and call `dismissInAppNotification()` immediately. On pointer up, cancellation, and lost capture, reset all local drag state.

  Bind a computed `--in-app-notification-drag-offset` style and an `in-app-notification--dragging` class to `.in-app-notification`. Bind `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, and `lostpointercapture` only to that element. Leave `.pull-to-refresh` unchanged.

- [x] **Step 4: Add CSS movement behavior**

  In `src/styles/main.css`, read the custom property in the base notification transform, add a short transform transition for snap-back, disable it for `.in-app-notification--dragging`, and set `touch-action: none`. Preserve existing enter and leave transitions.

- [x] **Step 5: Run the focused test to verify it passes**

  Run:

  ```powershell
  npm exec vitest -- run src/shared/components/__tests__/AppShell.test.ts
  ```

  Expected: all AppShell tests pass, covering live feedback, immediate threshold dismissal, and non-dismissal reset paths.

- [x] **Step 6: Run project verification**

  Run:

  ```powershell
  npm run build
  npm exec prettier -- --check src/shared/components/AppShell.vue src/shared/components/__tests__/AppShell.test.ts src/styles/main.css
  npm exec eslint -- src/shared/components/AppShell.vue src/shared/components/__tests__/AppShell.test.ts
  .\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/shared/components/AppShell.vue
  ```

  Expected: commands pass and the detector reports no blocking finding.

- [x] **Step 7: Leave the change uncommitted**

  Do not stage or commit. This project requires explicit user approval before commits.
