# App Control Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate browser-default visible controls across every OurWeek route while preserving behavior and accessibility.

**Architecture:** Audit controls by feature batch and choose from existing `BaseButton`, picker fields, dialog/sheet components, and shared classes. Replace only browser-dependent controls; retain semantic text inputs that are already comprehensively styled by `src/styles/main.css`.

**Tech Stack:** Vue 3, TypeScript, scoped CSS, Vitest, Vue Test Utils, Capacitor Android.

## Global Constraints

- Maintain existing behavior, routes, localization keys, feature gates, and event payloads.
- Use `meeting-primary`, `secondary-button`, `base-button--danger`, and existing picker components before adding code.
- Every button must have an intentional visual variant; every native disclosure/select/date/time widget must be replaced or already be a shared styled component.
- Preserve semantic elements, `aria-*` state, focus treatment, keyboard behavior, and 44px minimum touch targets.
- Do not add dependencies or commit without explicit user approval.

---

### Task 1: Establish control-audit test helpers and shared style vocabulary

**Files:**

- Modify: `src/shared/components/BaseButton.vue`
- Modify: `src/styles/main.css`
- Create: `src/shared/components/__tests__/controlAudit.test.ts`

**Interfaces:**

- Consumes: existing shared button classes and Vite component compilation.
- Produces: stable class variants for primary, secondary, danger, compact/icon, and disclosure controls.

- [ ] **Step 1:** Add a test that mounts `BaseButton` for primary/secondary/danger variants and asserts its rendered class contains the appropriate existing class.
- [ ] **Step 2:** Run `npx vitest run src/shared/components/__tests__/controlAudit.test.ts`; expect the new variant assertion to fail if a variant lacks an explicit class.
- [ ] **Step 3:** Ensure `BaseButton` maps each supported variant to a visible shared class and `main.css` supplies minimum touch-target, focus-visible, disabled, and active rules for those classes.
- [ ] **Step 4:** Run the focused test; expect PASS.

### Task 2: Complete the meeting flow control sweep

**Files:**

- Modify: `src/features/meeting/components/MeetingItemComposer.vue`
- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue`
- Modify: `src/features/meeting/components/MeetingFollowThrough.vue`
- Modify: `src/features/meeting/components/MeetingCheckInStep.vue`
- Modify: `src/features/meeting/components/MeetingItemCard.vue`
- Modify: `src/features/meeting/components/AiRecapRecoveryPanel.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`
- Modify: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

**Interfaces:**

- Consumes: existing capture, edit, delete, task status, and form-submit events.
- Produces: no native `details`, raw action buttons, native task responsibility selects, or native date controls in meeting screens.

- [ ] **Step 1:** Add assertions for the task composer’s optional-details toggle, review actions, unfinished-task actions, item-card edit/delete actions, and follow-through form controls so each has a shared class or shared picker component.
- [ ] **Step 2:** Run the related meeting component tests; expect failures for any remaining raw control.
- [ ] **Step 3:** Replace task composer’s `meeting-item-composer__optional-toggle` with the styled disclosure button pattern already used by `MeetingSectionStep`.
- [ ] **Step 4:** Replace `MeetingFollowThrough` native `select` and date input with `SelectPickerField` and `DatePickerField`, preserving its `responsibility` and `date` v-model values.
- [ ] **Step 5:** Apply `secondary-button`, danger, or compact/icon class variants to supporting action buttons in all listed meeting components; retain one primary action per panel.
- [ ] **Step 6:** Run all `src/features/meeting/components/__tests__` tests; expect PASS.

### Task 3: Sweep meeting history, details, templates, and task routes

**Files:**

- Modify: `src/pages/MeetingTemplatesPage.vue`
- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/pages/MeetingSummaryPage.vue`
- Modify: `src/pages/HistoryPage.vue`
- Modify: `src/pages/TasksPage.vue`
- Modify: `src/features/tasks/components/TaskSwipeActionCard.vue`
- Modify: `src/features/meeting/components/HistoryProgressSwipeCard.vue`
- Modify: matching page/component tests under `src/pages/__tests__` and feature `__tests__` folders.

**Interfaces:**

- Consumes: meeting history, task mutation, template selection, and summary navigation events.
- Produces: styled list controls, filters, task actions, and reusable pickers without changed data values.

- [ ] **Step 1:** Add structural tests that assert route controls use classes/components rather than unstyled `button`, `select`, or date input elements.
- [ ] **Step 2:** Replace native date/select controls with shared picker fields and classify all support actions as secondary, danger, or icon controls.
- [ ] **Step 3:** Preserve template selection, delete, restore, task status, and navigation events; run each matching test file to PASS.

### Task 4: Sweep participant, workspace, settings, subscription, calendar, export, and private-note routes

**Files:**

- Modify: `src/features/participants/components/AvatarPickerSheet.vue`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `src/features/auth/components/AccountSettingsSection.vue`
- Modify: `src/features/subscription/components/PlanCard.vue`
- Modify: `src/pages/SettingsPage.vue`
- Modify: `src/pages/UpgradePage.vue`
- Modify: `src/pages/CalendarSyncPage.vue`
- Modify: `src/pages/PrivateNotesPage.vue`
- Modify: `src/shared/components/UpgradePrompt.vue`
- Modify: matching tests.

**Interfaces:**

- Consumes: existing saving, subscription, OAuth preparation, and private-note actions.
- Produces: styled settings forms, choice controls, upgrade CTAs, and destructive actions.

- [ ] **Step 1:** Add tests for each component’s user-visible controls, including disabled and role-restricted states.
- [ ] **Step 2:** Use shared pickers for select/date/time values, and shared button classes for account, invitation, plan, export, and delete actions.
- [ ] **Step 3:** Run the matching test files; expect PASS without changes to service/API calls.

### Task 5: Sweep onboarding, authentication, legal, shell, dialogs, and shared components

**Files:**

- Modify: `src/pages/WelcomePage.vue`
- Modify: `src/pages/SignInPage.vue`
- Modify: `src/pages/SignUpPage.vue`
- Modify: `src/pages/ForgotPasswordPage.vue`
- Modify: `src/pages/ResetPasswordPage.vue`
- Modify: `src/pages/LogoutConfirmationPage.vue`
- Modify: `src/shared/components/AppShell.vue`
- Modify: `src/shared/components/ActionMenuPopup.vue`
- Modify: `src/shared/components/BaseBottomSheet.vue`
- Modify: `src/shared/components/BaseDialog.vue`
- Modify: `src/shared/components/ConfirmationDialog.vue`
- Modify: `src/shared/components/DatePickerField.vue`
- Modify: `src/shared/components/SelectPickerField.vue`
- Modify: `src/shared/components/TimePickerField.vue`
- Modify: matching tests.

**Interfaces:**

- Consumes: existing auth forms, dialog close events, and picker v-model contracts.
- Produces: consistent shared surfaces that prevent default controls from returning across all routes.

- [ ] **Step 1:** Add focused tests for auth submit/secondary actions, dialog close/icon controls, picker triggers/options, and empty-state CTAs.
- [ ] **Step 2:** Assign intentional shared variants to all raw button/link actions and preserve every accessible label.
- [ ] **Step 3:** Replace any remaining native control that does not have a fully styled shared implementation.
- [ ] **Step 4:** Run all shared-component and auth-page tests; expect PASS.

### Task 6: Final audit and Android verification

**Files:**

- Modify: no source files expected

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces: an auditable, validated mobile control system.

- [ ] **Step 1:** Run `rg -l -g '*.vue' '<(details|summary|select|input[^>]*type="date"|input[^>]*type="time")' src` and review every remaining result; each must be a shared component or have an intentional documented styled treatment.
- [ ] **Step 2:** Run `rg -l --pcre2 -g '*.vue' '<button(?![^>]*\bclass=)' src` and classify or replace every remaining result.
- [ ] **Step 3:** Run `npm run check`, `npm run build`, and `npm run cap:sync`; expect PASS.
- [ ] **Step 4:** Open each route on an Android-sized viewport and verify primary, secondary, danger, picker, icon, and disabled controls.
- [ ] **Step 5:** Run `git -c safe.directory=D:/Projects/myself/weekly-us diff --check`; expect no whitespace errors. Do not commit.

## Plan Self-Review

- Spec coverage: Tasks 1–5 cover all route/feature groups; Task 6 runs the two objective source audits and Android sync.
- Placeholder scan: every batch names files, controls, expected behavior, and tests.
- Type consistency: existing v-model values and event contracts are retained; only control rendering and styles change.
