# Top Error Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace transient inline operational errors with the existing top-of-screen error notification while preserving contextual validation and recovery messages.

**Architecture:** Action-owning components send local failures directly to `useInAppNotification`; pages consume shared-store failures through watched message state and clear each consumed message. Stores and the reminder composable expose narrow clear actions so revisiting a page cannot replay stale errors.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils

## Global Constraints

- Reuse `useInAppNotification`; add no dependency or second notification system.
- Pass `{ tone: 'error' }` for every migrated failure.
- Keep required-field, invalid-input, persistent permission explanation, loading, empty, sync-state, and recovery-panel messages inline.
- Preserve existing translations and unrelated working-tree changes.
- Do not create a Git commit unless explicitly requested.

---

## File Structure

- `src/app/stores/auth.ts`: expose one action for consuming the Google-link error.
- `src/app/stores/subscription.ts`: expose one action for consuming subscription errors.
- `src/app/stores/calendarSync.ts`: expose one action for consuming calendar errors.
- `src/shared/composables/useNotifications.ts`: expose one function for consuming reminder errors.
- `src/features/auth/components/AccountSettingsSection.vue`: notify directly for Google-link and account-data failures.
- `src/features/participants/components/HouseholdMembersSettings.vue`: keep input validation inline and notify for remote invite, revoke, and household-save failures.
- `src/pages/SettingsPage.vue`: consume subscription and reminder failures at the top notification.
- `src/pages/UpgradePage.vue`: consume subscription failures at the top notification.
- `src/pages/CalendarSyncPage.vue`: consume calendar failures at the top notification.
- `src/pages/MeetingDetailsPage.vue`: notify directly for copy, share, and PDF-export failures.
- `src/pages/MeetingSummaryPage.vue`: notify directly for summary-sharing failure.
- Existing focused test files alongside those components/pages: assert notification calls, clearing, and absence of migrated inline errors.

---

### Task 1: Add explicit error-consumption interfaces

**Files:**

- Modify: `src/app/stores/auth.ts`
- Modify: `src/app/stores/subscription.ts`
- Modify: `src/app/stores/calendarSync.ts`
- Modify: `src/shared/composables/useNotifications.ts`
- Test: `src/app/stores/__tests__/authSync.test.ts`
- Test: `src/app/stores/__tests__/subscription.test.ts`
- Test: `src/shared/composables/__tests__/useNotifications.test.ts`

**Interfaces:**

- Produces: `authStore.clearGoogleLinkErrorMessage(): void`
- Produces: `subscriptionStore.clearErrorMessage(): void`
- Produces: `calendarSyncStore.clearErrorMessage(): void`
- Produces: `clearLastError(): void` from `useNotifications()`

- [ ] **Step 1: Add failing tests for each clear interface**

Set the relevant error state, invoke the clear action, and assert an empty string or `null`:

```ts
store.googleLinkErrorMessage = 'account.googleLinkFailed';
store.clearGoogleLinkErrorMessage();
expect(store.googleLinkErrorMessage).toBe('');

store.errorMessage = 'upgrade.restoreFailed';
store.clearErrorMessage();
expect(store.errorMessage).toBe('');
```

For reminders, trigger an error, call `clearLastError()`, and assert `lastError.value` is `null`.

- [ ] **Step 2: Run the focused tests and verify the new calls fail**

Run:

```bash
npx vitest run src/app/stores/__tests__/authSync.test.ts src/app/stores/__tests__/subscription.test.ts src/shared/composables/__tests__/useNotifications.test.ts
```

Expected: FAIL because the clear interfaces do not exist.

- [ ] **Step 3: Implement the narrow clear interfaces**

Add store actions with no side effects beyond consuming feedback:

```ts
clearGoogleLinkErrorMessage() {
  this.googleLinkErrorMessage = '';
}

clearErrorMessage() {
  this.errorMessage = '';
}
```

Add and return the reminder function:

```ts
function clearLastError() {
  lastError.value = null;
}
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the Step 2 command. Expected: PASS.

---

### Task 2: Migrate account and household operational failures

**Files:**

- Modify: `src/features/auth/components/AccountSettingsSection.vue`
- Test: `src/features/auth/components/__tests__/AccountSettingsSection.test.ts`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Test: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

**Interfaces:**

- Consumes: `authStore.clearGoogleLinkErrorMessage(): void`
- Consumes: `showInAppNotification(message: string, options?: { tone?: 'status' | 'error'; durationMs?: number }): void`
- Produces: no new shared interface.

- [ ] **Step 1: Add failing account tests**

Extend the auth-store mock with reactive Google-link error state and `clearGoogleLinkErrorMessage`. Test a failed link result:

```ts
state.linkGoogleAccount.mockResolvedValue('failed');
state.googleLinkErrorMessage = 'account.googleEmailMismatch';

await wrapper.get('[data-testid="link-google-account"]').trigger('click');

expect(state.showInAppNotification).toHaveBeenCalledWith(
  'account.googleEmailMismatch',
  { tone: 'error' }
);
expect(state.clearGoogleLinkErrorMessage).toHaveBeenCalledOnce();
expect(wrapper.find('.meeting-error').exists()).toBe(false);
```

Add rejected account-export and failed account-deletion cases that expect the localized failure to be sent with the error tone and not rendered inside the card.

- [ ] **Step 2: Run the account test and verify failure**

Run:

```bash
npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts
```

Expected: FAIL because failed operations still render or retain inline state.

- [ ] **Step 3: Notify directly from account action boundaries**

In `linkGoogleAccount`, branch on `'failed'`, capture the current store message, notify with the error tone, and clear it. Replace every assignment to `dataActionError` in export, backend deletion, and cleanup retry failure branches with:

```ts
showInAppNotification(message, { tone: 'error' });
```

Remove `dataActionError`, its reset assignments, and both inline `<p class="meeting-error">` blocks. Keep the dedicated cleanup-failure section because it supplies persistent recovery actions.

- [ ] **Step 4: Run the account test and verify it passes**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Add failing household tests for remote failures and validation**

For invite delivery, revoke, resend, and household-name persistence failures, assert `showInAppNotification(message, { tone: 'error' })`. Separately assert that an empty or invalid email and an empty household name still render their field-linked inline messages.

- [ ] **Step 6: Run the household test and verify the new expectations fail**

Run:

```bash
npx vitest run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
```

Expected: FAIL for the remote-failure notification expectations.

- [ ] **Step 7: Split field validation from remote-action feedback**

Retain `inviteError` and `householdNameError` only for locally correctable values. In branches where a workspace store action fails, call:

```ts
showInAppNotification(
  workspaceStore.errorMessage || t('workspace.saveInviteFailed'),
  { tone: 'error' }
);
```

Use `workspace.revokeInvitationFailed` for revoke failures. Remove `revokeError` and its inline block. Do not change the existing notification for a delivery record whose `deliveryStatus` is `failed`; it already uses the correct error tone.

- [ ] **Step 8: Run both focused component tests**

Run:

```bash
npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
```

Expected: PASS.

---

### Task 3: Migrate subscription, calendar, and reminder errors

**Files:**

- Modify: `src/pages/SettingsPage.vue`
- Test: `src/pages/__tests__/SettingsPage.test.ts`
- Modify: `src/pages/UpgradePage.vue`
- Test: `src/pages/__tests__/UpgradePage.test.ts`
- Modify: `src/pages/CalendarSyncPage.vue`
- Test: `src/pages/__tests__/CalendarSyncPage.test.ts`

**Interfaces:**

- Consumes: `subscriptionStore.clearErrorMessage(): void`
- Consumes: `calendarSyncStore.clearErrorMessage(): void`
- Consumes: `clearLastError(): void`
- Consumes: the existing `showInAppNotification` signature.
- Produces: no new shared interface.

- [ ] **Step 1: Change existing subscription feedback tests to expect top error notifications**

In both page test files, initialize `errorMessage`, mount, and assert:

```ts
expect(state.showInAppNotification).toHaveBeenCalledWith(
  'upgrade.restoreFailed',
  { tone: 'error' }
);
expect(state.clearErrorMessage).toHaveBeenCalledOnce();
expect(wrapper.find('[role="alert"]').exists()).toBe(false);
```

Keep the existing success-status assertion as a separate case so success still uses the default tone.

- [ ] **Step 2: Run subscription page tests and verify failure**

Run:

```bash
npx vitest run src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts
```

Expected: FAIL because errors are still inline and are not consumed.

- [ ] **Step 3: Add error watchers and remove subscription inline markup**

On both pages, add an immediate watcher parallel to the status watcher:

```ts
watch(
  () => subscriptionStore.errorMessage,
  (message) => {
    if (!message) return;
    showInAppNotification(message, { tone: 'error' });
    subscriptionStore.clearErrorMessage();
  },
  { immediate: true }
);
```

Remove the subscription `<p class="meeting-error">` blocks.

- [ ] **Step 4: Add reminder-error coverage on Settings**

Make the `lastError` mock a ref, expose `clearLastError`, set an error before mounting, and assert one error-tone notification plus one clear call. Assert the reminder status text remains present while the former inline error text is absent.

- [ ] **Step 5: Consume reminder errors through a watcher**

Destructure `clearLastError` and add an immediate watcher for `notificationError.value`. Notify with the error tone, call `clearLastError`, and remove the inline reminder-error paragraph. Keep `reminderStatusText` because it represents persistent permission and scheduling state.

- [ ] **Step 6: Update and run calendar feedback tests**

Extend the calendar mock with `clearErrorMessage`, set `errorMessage` before mounting, and assert one error-tone notification, one clear call, and no inline alert. Run:

```bash
npx vitest run src/pages/__tests__/CalendarSyncPage.test.ts
```

Expected before implementation: FAIL.

- [ ] **Step 7: Add the calendar error watcher and remove inline markup**

Add a watcher equivalent to the subscription watcher, targeting `calendarSyncStore.errorMessage`, then remove the bottom inline error paragraph. Keep connection status and retry controls visible.

- [ ] **Step 8: Run all three page test files**

Run:

```bash
npx vitest run src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts src/pages/__tests__/CalendarSyncPage.test.ts
```

Expected: PASS.

---

### Task 4: Migrate meeting export and sharing failures

**Files:**

- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/pages/MeetingSummaryPage.vue`
- Test: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes: the existing `showInAppNotification` signature.
- Produces: no new shared interface.

- [ ] **Step 1: Add failing tests for copy, share, PDF, and summary-share failures**

Mock each delivery dependency to reject, trigger the corresponding action, and assert the localized message is sent with the error tone. For example:

```ts
expect(showInAppNotification).toHaveBeenCalledWith('meeting.copyFailed', {
  tone: 'error',
});
```

Also assert `.meeting-error` in the export dialog and `.meeting-summary-share-error` in the summary footer no longer exist after failures. Preserve existing AI recap recovery-panel assertions.

- [ ] **Step 2: Run the recap page tests and verify failure**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: FAIL because export and share failures still populate inline refs.

- [ ] **Step 3: Notify at each failed meeting action**

Remove `exportError` and `shareError`. In every relevant catch branch, compute the existing localized message and call:

```ts
showInAppNotification(message, { tone: 'error' });
```

Remove reset assignments and the two inline error elements. Do not modify `AiRecapRecoveryPanel`, because it is a persistent recovery surface rather than transient feedback.

- [ ] **Step 4: Run the recap page tests and verify they pass**

Run the Step 2 command. Expected: PASS.

---

### Task 5: Audit the boundary and run full verification

**Files:**

- Inspect: all Vue files under `src/`
- Modify only if a missed transient asynchronous inline error matches the approved scope.

**Interfaces:**

- Consumes: the completed notification and clear interfaces from Tasks 1–4.
- Produces: a verified codebase with no duplicate inline rendering for migrated failures.

- [ ] **Step 1: Search remaining inline error renderers**

Run:

```bash
rg -n 'meeting-error|meeting-summary-share-error|role="alert"' src --glob '*.vue'
```

Classify each remaining result. Expected retained categories: field validation, sign-in/reset form feedback, meeting composer validation, avatar color validation, invitation acceptance state, insights load/retry state, and AI recap recovery.

- [ ] **Step 2: Run all focused tests together**

Run:

```bash
npx vitest run src/app/stores/__tests__/authSync.test.ts src/app/stores/__tests__/subscription.test.ts src/shared/composables/__tests__/useNotifications.test.ts src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts src/pages/__tests__/CalendarSyncPage.test.ts src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: PASS.

- [ ] **Step 3: Format changed files**

Run:

```bash
npm run format
```

Review `git -c safe.directory=D:/Projects/myself/weekly-us diff --stat` afterward to ensure formatting did not expand into unrelated logic changes.

- [ ] **Step 4: Run the required production checks**

Run:

```bash
npm run build
npm run check
```

Expected: both commands exit successfully.

- [ ] **Step 5: Review the final diff**

Confirm that `package.json` and `src/features/localization/messages.ts` retain the user's pre-existing changes and that no new dependency, hardcoded user-facing string, or unrelated refactor was introduced.
