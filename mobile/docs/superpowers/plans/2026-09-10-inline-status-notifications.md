# Inline Status Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace temporary inline status confirmations with a single polished in-app notification that appears at the top of the app and dismisses after three seconds, without changing native toasts.

**Architecture:** Create an independent shared composable with one reactive notification state and one cleanup timer. `AppShell` renders that state as a safe-area-aware, animated top notification. Pages and feature components call the new composable for transient completion feedback; validation, recovery instructions, and persistent errors stay inline.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue transitions, CSS custom properties, Vitest, Vue Test Utils.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">`, typed Composition API code, and existing i18n keys; do not add dependencies.
- Keep `src/shared/composables/useToast.ts` and Capacitor-native toast behavior unchanged.
- Standard in-app notification duration is exactly 3000ms; a later message replaces an earlier one and restarts dismissal.
- Render below `env(safe-area-inset-top)`, animate in from above, and animate out above the viewport; honor reduced-motion preferences.
- Convert only transient completion and short feedback statuses. Retain inline field validation, task/meeting guidance, and recovery errors that need an on-screen action.
- Preserve semantic live announcements, a visible close button, 44px minimum close target, mobile-first layout, and existing color tokens.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Add the shared in-app notification state with a deterministic timeout

**Files:**

- Create: `src/shared/composables/useInAppNotification.ts`
- Create: `src/shared/composables/__tests__/useInAppNotification.test.ts`

**Interfaces:**

- Produces `useInAppNotification()` with `notificationState`, `showInAppNotification(message, options?)`, and `dismissInAppNotification()`.
- `notificationState` is `Readonly<Ref<InAppNotificationState | null>>`.
- `InAppNotificationState` is `{ id: number; message: string; tone: 'status' | 'error' }`.
- `InAppNotificationOptions` is `{ tone?: 'status' | 'error'; durationMs?: number }`; omitting `durationMs` uses `3000`.

- [ ] **Step 1: Write the failing composable tests**

  Create the test using fake timers and assert the default lifecycle, explicit tone, and replacement behavior:

  ```ts
  import { afterEach, describe, expect, it, vi } from 'vitest';
  import {
    dismissInAppNotification,
    notificationState,
    showInAppNotification,
  } from '../useInAppNotification';

  afterEach(() => {
    vi.useRealTimers();
    dismissInAppNotification();
  });

  it('dismisses a standard notification after three seconds', () => {
    vi.useFakeTimers();
    showInAppNotification('Account export downloaded.');
    expect(notificationState.value?.message).toBe('Account export downloaded.');
    vi.advanceTimersByTime(2999);
    expect(notificationState.value).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(notificationState.value).toBeNull();
  });

  it('replaces the active message and restarts its timeout', () => {
    vi.useFakeTimers();
    showInAppNotification('First message');
    const firstId = notificationState.value?.id;
    vi.advanceTimersByTime(2000);
    showInAppNotification('Second message', { tone: 'error' });
    expect(notificationState.value).toMatchObject({
      message: 'Second message',
      tone: 'error',
    });
    expect(notificationState.value?.id).not.toBe(firstId);
    vi.advanceTimersByTime(2000);
    expect(notificationState.value).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(notificationState.value).toBeNull();
  });
  ```

- [ ] **Step 2: Run the new test to verify it fails**

  Run: `npx vitest run src/shared/composables/__tests__/useInAppNotification.test.ts`

  Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement the small state owner**

  Define module-scoped state and one module-scoped timer. Clear the timer before setting state and only clear the current message from the callback:

  ```ts
  export type InAppNotificationTone = 'status' | 'error';

  export interface InAppNotificationState {
    id: number;
    message: string;
    tone: InAppNotificationTone;
  }

  export const notificationState = ref<InAppNotificationState | null>(null);
  const DEFAULT_DURATION_MS = 3000;
  let notificationId = 0;
  let dismissalTimer: ReturnType<typeof setTimeout> | undefined;

  export function showInAppNotification(
    message: string,
    options: InAppNotificationOptions = {}
  ) {
    dismissInAppNotification();
    notificationState.value = {
      id: ++notificationId,
      message,
      tone: options.tone ?? 'status',
    };
    dismissalTimer = setTimeout(
      dismissInAppNotification,
      options.durationMs ?? DEFAULT_DURATION_MS
    );
  }
  ```

  Export a `useInAppNotification()` wrapper that returns the readonly state and both functions. `dismissInAppNotification()` must clear `dismissalTimer`, set it to `undefined`, and set `notificationState.value` to `null`.

- [ ] **Step 4: Run the focused composable test**

  Run: `npx vitest run src/shared/composables/__tests__/useInAppNotification.test.ts`

  Expected: PASS, including the 3000ms boundary and reset timeout.

### Task 2: Render an accessible animated notification at the top of the app shell

**Files:**

- Modify: `src/shared/components/AppShell.vue: imports, notification markup, and close handler`
- Modify: `src/styles/main.css: add .in-app-notification rules and transition classes`
- Modify: `src/shared/components/__tests__/AppShell.test.ts: in-app notification mock and rendering assertion`

**Interfaces:**

- Consumes `useInAppNotification()` from Task 1.
- Produces one `AppShell` notification surface with `role="status"`, `aria-live="polite"`, a translation-backed close label, and a dismiss control.

- [ ] **Step 1: Add the failing AppShell rendering test**

  Extend the composable mock with a reactive status message and add:

  ```ts
  it('renders and dismisses the shared in-app notification', async () => {
    state.notificationState = {
      id: 1,
      message: 'Account export downloaded.',
      tone: 'status',
    };
    const wrapper = mountAppShell();
    expect(wrapper.get('.in-app-notification').text()).toContain(
      'Account export downloaded.'
    );
    await wrapper.get('.in-app-notification__dismiss').trigger('click');
    expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  });
  ```

- [ ] **Step 2: Run the AppShell test to verify it fails**

  Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

  Expected: FAIL because AppShell does not render `.in-app-notification`.

- [ ] **Step 3: Add the AppShell surface without touching useToast**

  Import `useInAppNotification`, destructure `notificationState` and `dismissInAppNotification`, and render this sibling of the existing `.app-toast` transition:

  ```vue
  <Transition name="in-app-notification">
    <aside
      v-if="notificationState"
      :key="notificationState.id"
      :class="[
        'in-app-notification',
        `in-app-notification--${notificationState.tone}`,
      ]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="material-symbols-outlined" aria-hidden="true">
        {{ notificationState.tone === 'error' ? 'error' : 'check_circle' }}
      </span>
      <span class="in-app-notification__message">{{ notificationState.message }}</span>
      <button
        class="in-app-notification__dismiss material-symbols-outlined"
        type="button"
        :aria-label="t('app.dismiss')"
        @click="dismissInAppNotification"
      >close</button>
    </aside>
  </Transition>
  ```

  Do not alter `useToast`, its imports, or the existing `.app-toast` markup.

- [ ] **Step 4: Add mobile-safe visual rules**

  Add a fixed, centered card with a `top: calc(32px + env(safe-area-inset-top))`, a capped mobile width, a non-obscuring z-index above page content, status/error token variants, and a 44px close target. Add the following transition behavior and its reduced-motion override:

  ```css
  .in-app-notification-enter-active,
  .in-app-notification-leave-active {
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .in-app-notification-enter-from,
  .in-app-notification-leave-to {
    opacity: 0;
    transform: translate(-50%, calc(-100% - 16px));
  }

  @media (prefers-reduced-motion: reduce) {
    .in-app-notification-enter-active,
    .in-app-notification-leave-active {
      transition-duration: 0.01ms;
    }
  }
  ```

- [ ] **Step 5: Run the AppShell test**

  Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

  Expected: PASS; the existing native-toast mock and tests remain unchanged.

### Task 3: Migrate direct transient page and feature confirmations

**Files:**

- Modify: `src/features/auth/components/AccountSettingsSection.vue`
- Modify: `src/features/auth/components/__tests__/AccountSettingsSection.test.ts`
- Modify: `src/pages/PrivateNotesPage.vue`
- Create: `src/pages/__tests__/PrivateNotesPage.test.ts`
- Modify: `src/pages/TasksPage.vue`
- Modify: `src/pages/__tests__/TasksPage.test.ts`
- Modify: `src/pages/MeetingDetailsPage.vue`
- Create: `src/pages/__tests__/MeetingDetailsPage.test.ts`
- Modify: `src/pages/ForgotPasswordPage.vue`
- Modify: `src/pages/ResetPasswordPage.vue`
- Create: `src/pages/__tests__/ForgotPasswordPage.test.ts`
- Create: `src/pages/__tests__/ResetPasswordPage.test.ts`

**Interfaces:**

- Consumes `showInAppNotification(message, { tone? })` from Task 1.
- Produces no lingering `meeting-status` element for export, account-link, note, task, meeting-export, or password-reset completion feedback.

- [ ] **Step 1: Write focused failing migration tests**

  In the Account settings test, mock the new composable and assert account export completion calls it once:

  ```ts
  vi.mock('@/shared/composables/useInAppNotification', () => ({
    useInAppNotification: () => ({
      showInAppNotification: state.showInAppNotification,
    }),
  }));

  expect(state.showInAppNotification).toHaveBeenCalledWith(
    'account.exportReady'
  );
  expect(wrapper.text()).not.toContain('account.exportReady');
  ```

  Add equivalent test cases for `privateNotes.noteSaved`, `privateNotes.noteUpdated`, `privateNotes.noteDeleted`, `tasksPage.taskUpdated`, `tasksPage.updated`, `tasksPage.markedDone`, `tasksPage.taskDeleted`, meeting export completion, `auth.resetRequested`, and `auth.resetConfirmed`.

- [ ] **Step 2: Run the focused migration tests to verify they fail**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/pages/__tests__/PrivateNotesPage.test.ts src/pages/__tests__/TasksPage.test.ts src/pages/__tests__/MeetingDetailsPage.test.ts src/pages/__tests__/ForgotPasswordPage.test.ts src/pages/__tests__/ResetPasswordPage.test.ts`

  Expected: FAIL because the components still set and render local status strings.

- [ ] **Step 3: Replace only transient completion writes**

  In each listed component, import the notification composable and replace completion assignments such as:

  ```ts
  dataActionStatus.value = t('account.exportReady');
  statusMessage.value = t('privateNotes.noteDeleted');
  ```

  with:

  ```ts
  showInAppNotification(t('account.exportReady'));
  showInAppNotification(t('privateNotes.noteDeleted'));
  ```

  Delete the matching inline `meeting-status` template nodes and remove local refs that no longer serve other behavior. Keep `dataActionError`, `formError`, and password-reset navigation state inline. For Forgot Password, preserve the route link by adding a dedicated `hasRequestedReset` boolean instead of retaining a visible status string. For Reset Password, preserve its 1600ms sign-in redirect while showing the shared success notification.

  Do not migrate `tasksPage.addShortTitle`, `meeting.roleCannotEditTasks`, `tasksPage.ownerDeleteOnly`, or other task permission/validation messages in this task: they guide corrective action and must remain inline.

- [ ] **Step 4: Run the direct-confirmation test set**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/pages/__tests__/PrivateNotesPage.test.ts src/pages/__tests__/TasksPage.test.ts src/pages/__tests__/MeetingDetailsPage.test.ts src/pages/__tests__/ForgotPasswordPage.test.ts src/pages/__tests__/ResetPasswordPage.test.ts`

  Expected: PASS. The source has no inline rendering for the listed completion messages.

### Task 4: Migrate calendar and subscription transient results while retaining actionable failures

**Files:**

- Modify: `src/app/stores/calendarSync.ts`
- Modify: `src/pages/CalendarSyncPage.vue`
- Modify: `src/pages/__tests__/CalendarSyncPage.test.ts`
- Modify: `src/app/stores/subscription.ts`
- Modify: `src/pages/SettingsPage.vue`
- Modify: `src/pages/UpgradePage.vue`
- Modify: `src/pages/__tests__/SettingsPage.test.ts`
- Modify: `src/pages/__tests__/UpgradePage.test.ts`

**Interfaces:**

- Consumes `showInAppNotification` at the caller that completes a calendar or subscription action.
- Produces one transient notification per completed operation; `errorMessage` continues to render in the originating screen.

- [ ] **Step 1: Add failing page tests for store-produced status messages**

  In CalendarSyncPage, set `calendarSyncStore.statusMessage` to a known message, mount the page, and assert it is forwarded once to `showInAppNotification` and then cleared. In SettingsPage and UpgradePage, do the same with `subscriptionStore.statusMessage` and assert neither page renders the string inline.

  ```ts
  state.subscription.statusMessage = 'upgrade.premiumRestored';
  mountSettingsPage();
  expect(state.showInAppNotification).toHaveBeenCalledWith(
    'upgrade.premiumRestored'
  );
  expect(state.subscription.statusMessage).toBe('');
  ```

- [ ] **Step 2: Run the calendar and subscription tests to verify they fail**

  Run: `npx vitest run src/pages/__tests__/CalendarSyncPage.test.ts src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts`

  Expected: FAIL because status output is still embedded in page markup and is not consumed.

- [ ] **Step 3: Consume status messages through one watcher per active screen**

  Add `clearStatusMessage()` actions to the calendar and subscription stores that set only their `statusMessage` to `''`. In CalendarSyncPage, SettingsPage, and UpgradePage, watch the relevant status string with `flush: 'post'`; when it is non-empty, call `showInAppNotification(message)` and then the store clear action:

  ```ts
  watch(
    () => subscriptionStore.statusMessage,
    (message) => {
      if (!message) return;
      showInAppNotification(message);
      subscriptionStore.clearStatusMessage();
    }
  );
  ```

  Remove only `statusMessage` template blocks from those pages. Leave `errorMessage`, connection summary text, billing availability copy, and retry actions rendered inline. Keep CalendarSyncPage’s existing native `useToast()` calls for OAuth callback results; they are intentionally native toasts and are out of scope.

- [ ] **Step 4: Run the calendar and subscription tests**

  Run: `npx vitest run src/pages/__tests__/CalendarSyncPage.test.ts src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts`

  Expected: PASS. Store status values are consumed once, then cleared; inline error/recovery elements remain.

### Task 5: Audit the remaining inline status elements and run full verification

**Files:**

- Verify or modify only when it represents transient feedback: `src/features/participants/components/HouseholdMembersSettings.vue`, `src/features/meeting/components/MeetingCheckInStep.vue`, `src/features/meeting/components/MeetingSectionStep.vue`, `src/features/meeting/components/MeetingReviewCloseStep.vue`, `src/pages/SettingsPage.vue`
- Verify: `src/shared/composables/useToast.ts`

**Interfaces:**

- Consumes the finished notification service from Tasks 1-4.
- Produces an audited split: transient confirmation uses the top notification; contextual/validation/recovery content stays inline.

- [ ] **Step 1: Classify every remaining inline status before changing it**

  Run: `rg -n -i "meeting-status|statusMessage|successMessage|dataActionStatus|exportStatus" src --glob "*.vue"`

  For each result, retain it when it answers a current-form or current-meeting question (for example, missing required content, permissions, recap limits, reminder availability, or an operation with a retry action). Migrate it only when it is a completed save, update, deletion, export, connection, or restore confirmation with no on-screen recovery needed.

- [ ] **Step 2: Add focused test coverage before each audit migration**

  For each newly classified transient message, add a test that triggers its action, asserts `showInAppNotification(t('message.key'))`, and asserts the message no longer occurs in the component’s rendered inline status node. Do not modify a component that lacks a transient confirmation.

- [ ] **Step 3: Preserve native toasts exactly**

  Run: `git diff -- src/shared/composables/useToast.ts src/app/composables/useNativeToast.ts src/pages/CalendarSyncPage.vue`

  Expected: no changes in `useToast.ts` or `useNativeToast.ts`; CalendarSyncPage retains its OAuth callback `showToast` behavior.

- [ ] **Step 4: Run all notification-focused tests**

  Run: `npx vitest run src/shared/composables/__tests__/useInAppNotification.test.ts src/shared/components/__tests__/AppShell.test.ts src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/pages/__tests__/PrivateNotesPage.test.ts src/pages/__tests__/TasksPage.test.ts src/pages/__tests__/MeetingDetailsPage.test.ts src/pages/__tests__/ForgotPasswordPage.test.ts src/pages/__tests__/ResetPasswordPage.test.ts src/pages/__tests__/CalendarSyncPage.test.ts src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts`

  Expected: PASS.

- [ ] **Step 5: Run project quality gates and manual mobile visual QA**

  Run: `npm run build && npm run check`

  Expected: PASS.

  Run: `npm run dev`

  In a narrow mobile viewport, trigger an account export, a private-note save, and a task completion. Verify the card appears below the safe area, its close target is usable, it leaves upward after 3 seconds, a second message replaces the first, and reduced-motion avoids a noticeable slide. Verify a calendar OAuth callback still uses the native toast. Stop the dev server after testing; do not commit without explicit user approval.

## Plan Self-Review

- Spec coverage: Task 1 implements the shared 3-second state contract; Task 2 adds the top in-app surface and its safe-area animation; Tasks 3-4 migrate the confirmed transient sources while retaining native toasts and inline recovery; Task 5 audits remaining status output and validates the complete behavior.
- Placeholder scan: all implementation and test actions name concrete files, APIs, selectors, commands, and expected outcomes; no deferred behavior is required.
- Type consistency: every caller uses `showInAppNotification(message, { tone? })`; AppShell reads `notificationState`; stores expose `clearStatusMessage()` only for their existing string state.
