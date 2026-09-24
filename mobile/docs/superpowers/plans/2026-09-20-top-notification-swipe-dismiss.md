# Top Notification Upward-Swipe Dismissal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make only the top in-app notification dismissible with a deliberate upward swipe, while preserving pull-to-refresh unchanged.

**Architecture:** `AppShell.vue` owns the notification gesture because it renders the notification and already owns notification dismissal. Bind its existing pointer-down/up handlers to the notification element, add a cancellation reset, and leave the pull-to-refresh markup and pointer handlers untouched. Component tests exercise events on the notification DOM node rather than calling setup functions directly.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils.

## Global Constraints

- Do not alter the current pull-to-refresh pointer handlers or behavior.
- Dismiss only after an upward movement of 48px or more whose vertical distance exceeds its horizontal distance.
- Downward, sideways, short, and cancelled interactions keep the notification visible.
- Preserve the existing mobile UI, notification copy, accessibility roles, and transition.
- Do not add dependencies or commit changes unless the user explicitly asks.

---

### Task 1: Bind and verify the notification-only dismissal gesture

**Files:**

- Modify: `src/shared/components/AppShell.vue:125-141, 195-196, 264-282`
- Modify: `src/shared/components/__tests__/AppShell.test.ts:115-184`

**Interfaces:**

- Consumes: `dismissInAppNotification(): void` from `useInAppNotification()`.
- Produces: `handleInAppNotificationPointerDown(event: PointerEvent): void`, `handleInAppNotificationPointerUp(event: PointerEvent): void`, and `handleInAppNotificationPointerCancel(): void` for the top notification element.

- [ ] **Step 1: Write the failing rendered-gesture tests**

  In `AppShell.test.ts`, replace the setup-state helper calls with DOM events on the notification. Cover an upward threshold-crossing gesture, a short upward gesture, a downward gesture, and cancellation:

  ```ts
  const notification = wrapper.get('.in-app-notification');

  await notification.trigger('pointerdown', { clientY: 180 });
  await notification.trigger('pointerup', { clientY: 120 });

  expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  ```

  For cancellation, begin the gesture, trigger `pointercancel`, then trigger `pointerup` with a value that would otherwise meet the threshold and assert no dismissal.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run:

  ```powershell
  npm test -- src/shared/components/__tests__/AppShell.test.ts
  ```

  Expected: the upward DOM-event test fails because the notification has no pointer handlers.

- [ ] **Step 3: Bind the minimal notification handlers**

  In `AppShell.vue`, add a cancellation handler that clears the stored start position:

  ```ts
  function handleInAppNotificationPointerCancel() {
    inAppNotificationTouchStartY.value = null;
  }
  ```

  Move neither of the handlers currently on `.pull-to-refresh`. Instead, add these listeners to the rendered `.in-app-notification` element:

  ```vue
  @pointerdown="handleInAppNotificationPointerDown"
  @pointerup="handleInAppNotificationPointerUp"
  @pointercancel="handleInAppNotificationPointerCancel"
  ```

  The existing pointer-up condition remains the source of truth for the 48px upward threshold.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run:

  ```powershell
  npm test -- src/shared/components/__tests__/AppShell.test.ts
  ```

  Expected: all AppShell tests pass, including the notification’s upward, non-upward, short, and cancelled gesture cases.

- [ ] **Step 5: Run project verification**

  Run:

  ```powershell
  npm run build
  npm run check
  .\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/shared/components/AppShell.vue
  ```

  Expected: build and checks pass; the detector reports no blocking finding for `AppShell.vue`.

- [ ] **Step 6: Leave the change uncommitted**

  Do not stage or commit. This project requires an explicit user request before creating commits.
