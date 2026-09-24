# Notification Permission Decline Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure declined Android notification access leaves reminder settings off and immediately explains the result with a short toast.

**Architecture:** `useNotifications` will expose a typed result for each reminder-enable outcome and will own cleanup for every unsuccessful native permission request. `SettingsPage` will consume the result, explicitly clear the checkbox after an unsuccessful native outcome, and show a localized toast only when access was declined.

**Tech Stack:** Vue 3.5 Composition API, TypeScript 6, Pinia 4, Capacitor Local Notifications 8.3.1, vue-i18n 11.4, Vitest 4.

## Global Constraints

- Do not add dependencies.
- Native notification permission requests must fail safely in browser development and on plugin errors.
- Android does not reliably show a second native permission prompt after a denial; do not call the request API when its checked state is already `denied`.
- Persisted reminder settings must be disabled and pending local reminders cancelled for all unsuccessful native enable attempts.
- Use the exact English toast text: `Notifications access was declined` and provide Ukrainian and Spanish translations.
- Keep user-facing copy calm and concise; do not expose technical errors.
- Do not commit unless the user explicitly asks.

---

### Task 1: Make reminder permission outcomes explicit and safe

**Files:**

- Modify: `src/shared/composables/useNotifications.ts:16-115`
- Test: `src/shared/composables/__tests__/useNotifications.test.ts`

**Interfaces:**

- Consumes: `checkNotificationPermission(): Promise<PermissionStatus | null>`, `requestNotificationPermission(): Promise<PermissionStatus | null>`, and `cancelReminderNotifications(): Promise<void>` from `@/features/reminders/reminderService`.
- Produces: `export type EnableRemindersResult = 'enabled' | 'permission-denied' | 'unavailable' | 'error' | 'premium-only'`.
- Produces: `enableReminders(): Promise<EnableRemindersResult>`. It returns `enabled` only after the permission is granted and reminder scheduling is attempted; all unsuccessful native outcomes leave `remindersStore.settings.enabled === false`.

- [ ] **Step 1: Write failing tests for checked denial and request failure**

In `src/shared/composables/__tests__/useNotifications.test.ts`, update the existing enable tests to assert result strings rather than booleans. Add these cases:

```ts
it('does not re-request Android permission once it is denied', async () => {
  reminderServiceMocks.checkNotificationPermission.mockResolvedValue({
    display: 'denied',
  });

  const { enableReminders } = useNotifications();

  await expect(enableReminders()).resolves.toBe('permission-denied');
  expect(remindersStore.settings.enabled).toBe(false);
  expect(
    reminderServiceMocks.requestNotificationPermission
  ).not.toHaveBeenCalled();
  expect(
    reminderServiceMocks.cancelReminderNotifications
  ).toHaveBeenCalledOnce();
});

it('disables reminders if the native request rejects', async () => {
  reminderServiceMocks.requestNotificationPermission.mockRejectedValue(
    new Error('native request failed')
  );

  await expect(enableReminders()).resolves.toBe('error');
  expect(remindersStore.settings.enabled).toBe(false);
  expect(
    reminderServiceMocks.cancelReminderNotifications
  ).toHaveBeenCalledOnce();
});
```

Retain and update the successful grant and explicit request-denied coverage. Verify that an explicitly denied request returns `permission-denied`, disables the persisted setting, and cancels pending notifications.

- [ ] **Step 2: Run the focused tests to establish failure**

Run:

```powershell
npx vitest run src/shared/composables/__tests__/useNotifications.test.ts
```

Expected: FAIL because `enableReminders()` currently returns booleans and does not check for an already-denied permission before requesting again.

- [ ] **Step 3: Implement typed outcomes and centralized failed-enable cleanup**

In `useNotifications.ts`, add the exported result type and a focused cleanup helper:

```ts
export type EnableRemindersResult =
  'enabled' | 'permission-denied' | 'unavailable' | 'error' | 'premium-only';

async function disableAfterUnsuccessfulEnable() {
  remindersStore.setEnabled(false);
  await cancelReminderNotifications();
}
```

Update `enableReminders()` to first call `checkNotificationPermission()`. If it returns `display: 'denied'`, set `permissionStatus` to `denied`, run `disableAfterUnsuccessfulEnable()`, and return `permission-denied` without calling `requestNotificationPermission()`.

If the checked status permits a prompt, request it inside `try/catch`. A response whose `display` is not `granted` performs the same cleanup and returns `permission-denied`; a thrown request performs cleanup, sets the existing `notifications.updateFailed` error, and returns `error`. Preserve browser-development behavior by returning `unavailable` after retaining its existing saved-setting behavior only when the notification plugin is unavailable. Preserve the Premium-lock path but return `premium-only`.

- [ ] **Step 4: Run the focused tests to verify the behavior**

Run:

```powershell
npx vitest run src/shared/composables/__tests__/useNotifications.test.ts
```

Expected: PASS, including the no-second-prompt, explicit-denial, rejection, scheduling, and disabled-state cases.

### Task 2: Notify users after a declined reminder permission request

**Files:**

- Modify: `src/pages/SettingsPage.vue:1-44, 133-142`
- Modify: `src/features/localization/messages.ts:631-636, 2055-2060`
- Test: `src/pages/__tests__/SettingsPage.test.ts`

**Interfaces:**

- Consumes: `enableReminders(): Promise<EnableRemindersResult>` from `useNotifications()`.
- Consumes: `showToast(message: string, options?: ToastOptions): Promise<void>` from `useToast()`.
- Consumes: `t('notifications.permissionDeclined')` from vue-i18n.
- Produces: A declined enable attempt displays one toast while the persisted reminder setting remains false and the checkbox rerenders unchecked.

- [ ] **Step 1: Write failing Settings-page toast coverage**

Extend `src/pages/__tests__/SettingsPage.test.ts` with hoisted `enableReminders` and `showToast` mocks. Make `enableReminders` resolve to `permission-denied`, mount `SettingsPage` with reminder access enabled, and trigger the checkbox change:

```ts
await wrapper.get('input[type="checkbox"]').setValue(true);

expect(state.enableReminders).toHaveBeenCalledOnce();
expect(state.showToast).toHaveBeenCalledWith(
  'notifications.permissionDeclined'
);
```

Keep the mock reminder store’s `settings.enabled` false and assert the checkbox is not checked after Vue updates. Also verify a non-declined `enabled` result does not display this toast.

- [ ] **Step 2: Run the focused Settings-page test to establish failure**

Run:

```powershell
npx vitest run src/pages/__tests__/SettingsPage.test.ts
```

Expected: FAIL because the page neither consumes an enable result nor invokes the toast composable.

- [ ] **Step 3: Display the localized declined-access toast**

Import `useToast` in `SettingsPage.vue` and obtain `showToast`. Change `handleReminderEnabledChange()` to store the `HTMLInputElement` from the event and the `EnableRemindersResult` returned by `enableReminders()`. When it equals `permission-denied`, first set `input.checked = false`, then call:

```ts
await showToast(t('notifications.permissionDeclined'));
```

Add `notifications.permissionDeclined` to the English messages as `Notifications access was declined`, Ukrainian messages as `Доступ до сповіщень відхилено`, and Spanish messages as `Se rechazó el acceso a las notificaciones`. For `error` and `premium-only` results, also set `input.checked = false` without showing the declined-access toast. Do not show the toast when the toggle is switched off, permission is granted, or another failure occurs.

- [ ] **Step 4: Run focused UI and composable coverage**

Run:

```powershell
npx vitest run src/pages/__tests__/SettingsPage.test.ts src/shared/composables/__tests__/useNotifications.test.ts
```

Expected: PASS. The Settings test verifies the exact localized toast key and an unchecked toggle; the composable tests verify Android no-prompt behavior after denial.

### Task 3: Verify the integrated change

**Files:**

- Verify only: `src/shared/composables/useNotifications.ts`, `src/pages/SettingsPage.vue`, `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: The completed typed permission result and Settings-page toast behavior from Tasks 1 and 2.
- Produces: A buildable, linted mobile UI that handles declined Android notification permission without incorrectly persisting enabled reminders.

- [ ] **Step 1: Check formatting**

Run:

```powershell
npm run format:check
```

Expected: PASS. If it reports only the touched files, run `npm run format`, then re-run the check.

- [ ] **Step 2: Run static checks**

Run:

```powershell
npm run check
```

Expected: PASS with no TypeScript-facing lint errors, unused imports, or Vue template violations.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS, including `vue-tsc --noEmit` and the Vite build.

- [ ] **Step 4: Manually verify on Android**

Use a device where OurWeek notification access is denied. Open Settings, turn on Reminder notifications, and verify that the checkbox returns to off and shows `Notifications access was declined`. Tap the toggle again and verify the app immediately shows the same toast without presenting a native Android prompt. Enable notifications for OurWeek in Android system settings, return to the app, enable reminders, and verify the toggle remains on and reminders schedule.
