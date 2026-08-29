# Notification Tap to Meeting Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the meeting-template selection screen when either local reminder notification is tapped.

**Architecture:** Add a focused app composable that subscribes to Capacitor Local Notifications' action-performed event only on supported native platforms. `App.vue` initializes it beside existing native listeners; the composable uses Vue Router to navigate to the already-existing `meeting-templates` route and cleans up its listener on unmount.

**Tech Stack:** Vue 3 Composition API, Vue Router 5, Capacitor Local Notifications 8.3.1, Vitest 4.

## Global Constraints

- Register only on native platforms with the Local Notifications plugin available; browser development must remain a no-op.
- Taps on both reminder IDs navigate to the same existing `meeting-templates` route.
- Preserve existing notification schedules, copy, Android intent configuration, deep links, router guards, access locks, and draft-resume behavior.
- Wait for router readiness before navigating and contain listener-navigation failures to avoid unhandled native callback rejections.
- Do not add dependencies or commit without explicit user instruction.

---

### Task 1: Add native notification-tap navigation

**Files:**

- Create: `src/app/composables/useNotificationActions.ts`
- Modify: `src/app/App.vue:1-70`
- Test: `src/app/composables/__tests__/useNotificationActions.test.ts`

**Interfaces:**

- Consumes: `LocalNotifications.addListener('localNotificationActionPerformed', listener)` and `PluginListenerHandle.remove(): Promise<void>`.
- Consumes: `router.isReady(): Promise<void>` and `router.push({ name: 'meeting-templates' }): Promise<unknown>`.
- Produces: `useNotificationActions(): void`, which owns one native listener for the lifetime of the app shell.

- [ ] **Step 1: Write failing lifecycle tests**

Create `src/app/composables/__tests__/useNotificationActions.test.ts` with the `happy-dom` Vitest environment. Mock `@capacitor/core` with `isNativePlatform` and `isPluginAvailable`, mock `@capacitor/local-notifications` with `addListener`, and mock Vue Router's `useRouter` to expose `isReady` and `push`. Mount a component whose setup invokes `useNotificationActions()`.

Add tests that assert:

```ts
expect(addListener).toHaveBeenCalledWith(
  'localNotificationActionPerformed',
  expect.any(Function)
);

await actionListener({ notification: { id: 840_100 } });
expect(router.isReady).toHaveBeenCalledOnce();
expect(router.push).toHaveBeenCalledWith({ name: 'meeting-templates' });
```

Also verify no listener is registered when `isNativePlatform()` is false or `isPluginAvailable('LocalNotifications')` is false, and that unmounting calls the returned listener handle's `remove()` function.

- [ ] **Step 2: Run the targeted test to establish the failure**

Run:

```powershell
npx vitest run src/app/composables/__tests__/useNotificationActions.test.ts
```

Expected: FAIL because `useNotificationActions.ts` does not yet exist.

- [ ] **Step 3: Implement the listener composable**

Create `src/app/composables/useNotificationActions.ts` using this structure:

```ts
let notificationActionListener: PluginListenerHandle | null = null;

onMounted(async () => {
  if (
    !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable('LocalNotifications')
  ) {
    return;
  }

  notificationActionListener = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    async () => {
      try {
        await router.isReady();
        await router.push({ name: 'meeting-templates' });
      } catch {
        // Native notification navigation must not throw from the listener.
      }
    }
  );
});

onBeforeUnmount(() => {
  void notificationActionListener?.remove();
  notificationActionListener = null;
});
```

Declare `notificationActionListener` inside `useNotificationActions`, alongside `const router = useRouter()`, so each mounted app shell owns its own handle. Import `onBeforeUnmount`, `onMounted`, `useRouter`, `Capacitor`, `LocalNotifications`, and `PluginListenerHandle` from their existing packages.

- [ ] **Step 4: Initialize the composable at the app level**

In `src/app/App.vue`, import `useNotificationActions` from `@/app/composables/useNotificationActions` and call it once beside `useDeepLinks()`, `useAndroidBackButton()`, and `initializeReminderSync()`. Do not move existing initialization calls or change the app shell template.

- [ ] **Step 5: Run targeted test and project checks**

Run:

```powershell
npx vitest run src/app/composables/__tests__/useNotificationActions.test.ts
npm run build
npx prettier --check src/app/App.vue src/app/composables/useNotificationActions.ts src/app/composables/__tests__/useNotificationActions.test.ts
```

Expected: the new tests, TypeScript build, and formatting check all exit successfully.

- [ ] **Step 6: Verify the Android flow**

Run:

```powershell
npm run cap:sync
Set-Location android
.\gradlew.bat :app:assembleDebug
```

Install the debug APK. With notification permission granted, schedule either reminder, tap it while the app is foregrounded, then repeat after closing the app. Expected: each tap opens `/meeting/templates`; an active draft stays available as the page's existing “continue draft” option.

## Plan self-review

- Spec coverage: Task 1 adds one native-only action listener, routes both reminder taps to `meeting-templates`, preserves existing navigation behavior, cleans up the listener, handles routing failures, and specifies automated plus Android verification.
- Placeholder scan: no incomplete requirements or deferred implementation markers are present.
- Type consistency: the composable name, Capacitor event name, listener-handle contract, and Vue Router destination are consistent across all steps.
