# Inline Notification Swipe Dismissal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the top notification close button and let a deliberate upward swipe dismiss the notification before its standard 3-second timeout.

**Architecture:** Keep timeout state in `useInAppNotification` unchanged. `AppShell` owns Pointer Event start/end tracking and calls its existing `dismissInAppNotification()` method only when a pointer finishes at least 48px above its start point. Pointer Events receive touch swipes on Android. The notification remains otherwise non-interactive and retains its automatic dismissal.

**Tech Stack:** Vue 3 Composition API, TypeScript, CSS, Vitest, Vue Test Utils.

## Global Constraints

- Keep `src/shared/composables/useToast.ts` and Capacitor-native toast behavior unchanged.
- Keep the standard in-app notification timeout at exactly 3000ms.
- Remove the visible close control; an upward swipe of at least 48px is the only manual dismissal gesture.
- Do not dismiss for taps, horizontal swipes, downward swipes, or upward movement smaller than 48px.
- Preserve the existing top safe-area placement, enter/leave animation, semantic live announcement, mobile-first layout, and reduced-motion behavior.
- Do not add dependencies or commit unless the user explicitly requests it.

---

### Task 1: Replace the close control with deliberate upward-swipe dismissal

**Files:**

- Modify: `src/shared/components/AppShell.vue: notification gesture handlers and template`
- Modify: `src/styles/main.css: notification grid and remove close-control rules`
- Modify: `src/shared/components/__tests__/AppShell.test.ts: swipe behavior assertions`

**Interfaces:**

- Consumes `dismissInAppNotification(): void` from `useInAppNotification()`.
- Produces `handleInAppNotificationPointerDown(event: PointerEvent): void` and `handleInAppNotificationPointerUp(event: PointerEvent): void` inside `AppShell`.
- A touch dismisses only when `touchStartY - touchEndY >= 48`.

- [ ] **Step 1: Write failing swipe tests**

  Replace the current close-button test with touch events that use an explicit `Touch`-like payload:

  ```ts
  it('dismisses after a deliberate upward swipe', async () => {
    state.notificationState.value = {
      id: 1,
      message: 'Account export downloaded.',
      tone: 'status',
    };
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');
    handlers.handleInAppNotificationPointerDown({ clientY: 180 } as PointerEvent);
    handlers.handleInAppNotificationPointerUp({ clientY: 120 } as PointerEvent);
    expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  });

  it('keeps the notification for a tap or a short upward movement', async () => {
    state.notificationState.value = {
      id: 1,
      message: 'Account export downloaded.',
      tone: 'status',
    };
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');
    handlers.handleInAppNotificationPointerDown({ clientY: 180 } as PointerEvent);
    handlers.handleInAppNotificationPointerUp({ clientY: 150 } as PointerEvent);
    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
    expect(wrapper.find('.in-app-notification__dismiss').exists()).toBe(false);
  });
  ```

- [ ] **Step 2: Run the AppShell test to verify it fails**

  Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

  Expected: FAIL because AppShell still contains a close button and no touch handlers.

- [ ] **Step 3: Implement touch tracking and remove the button**

  Add a module-local threshold and component-local start coordinate next to the existing notification composable use:

  ```ts
  const IN_APP_NOTIFICATION_SWIPE_DISMISS_THRESHOLD = 48;
  const inAppNotificationTouchStartY = ref<number | null>(null);

  function handleInAppNotificationPointerDown(event: PointerEvent) {
    inAppNotificationTouchStartY.value = event.clientY;
  }

  function handleInAppNotificationPointerUp(event: PointerEvent) {
    const startY = inAppNotificationTouchStartY.value;
    const endY = event.clientY;
    inAppNotificationTouchStartY.value = null;

    if (
      startY !== null &&
      endY !== undefined &&
      startY - endY >= IN_APP_NOTIFICATION_SWIPE_DISMISS_THRESHOLD
    ) {
      dismissInAppNotification();
    }
  }
  ```

  Attach `@pointerdown="handleInAppNotificationPointerDown"` and `@pointerup="handleInAppNotificationPointerUp"` to the notification `aside`. Remove its close `button` completely. Do not change the notification composable or `useToast`.

- [ ] **Step 4: Remove the obsolete close-control style without changing content alignment**

  Remove `.in-app-notification__dismiss` and change the card to a two-column
  layout that preserves the existing icon/message alignment:

  ```css
  .in-app-notification {
    grid-template-columns: auto minmax(0, 1fr);
  }
  ```

  Do not add horizontal centering or alter the existing icon/message alignment.
  Do not change colors, safe-area offset, or transition selectors.

- [ ] **Step 5: Run the focused test and formatting check**

  Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

  Expected: PASS for upward swipe, tap/short movement retention, and close-control removal.

  Run: `npx prettier --check src/shared/components/AppShell.vue src/shared/components/__tests__/AppShell.test.ts src/styles/main.css`

  Expected: PASS.

### Task 2: Run regression checks

**Files:**

- Verify only: `src/shared/composables/useInAppNotification.ts`, `src/shared/components/AppShell.vue`, `src/shared/components/__tests__/AppShell.test.ts`, `src/styles/main.css`

**Interfaces:**

- Consumes the completed swipe surface from Task 1.
- Produces verified automatic timeout, manual swipe dismissal, and unchanged native-toast behavior.

- [ ] **Step 1: Run notification and app-shell tests**

  Run: `npx vitest run src/shared/composables/__tests__/useInAppNotification.test.ts src/shared/components/__tests__/AppShell.test.ts`

  Expected: PASS. The composable retains its 3-second timeout and AppShell dismisses only for a qualifying upward swipe.

- [ ] **Step 2: Run build and lint verification**

  Run: `npm run build`

  Expected: PASS.

  Run: `npx eslint src/shared/components/AppShell.vue src/shared/components/__tests__/AppShell.test.ts`

  Expected: PASS.

## Plan Self-Review

- Spec coverage: Task 1 removes the button, implements an upward-only 48px manual-dismiss gesture, preserves the timeout, and retains the existing content alignment; Task 2 validates the notification contract and app build.
- Placeholder scan: every task contains concrete files, selectors, threshold, test actions, commands, and expected result.
- Type consistency: both template listeners call the two typed Pointer Event handlers, and the handlers call the existing `dismissInAppNotification()` function.
