# MVP Start Required Changes

Audit date: 2026-06-04

Scope: this checklist covers what is still needed for a user-facing MVP start or serious Android internal test. It intentionally excludes real backend API connection work, backend sync, backend auth, backend AI, and backend subscription validation. Those remain future production work.

## Definition Used For This Audit

- The MVP may stay local-only.
- The app must not pretend that cloud sync, real accounts, real billing, real Google Calendar sync, encryption, or production AI exists.
- User-facing screens should not expose debug controls, mock labels, or placeholder promises.
- Premium locks can stay, but users should not be able to buy or "mock buy" Premium in a user-facing build.

## P0 - Must Fix Before MVP Start

### Replace placeholder legal and store disclosure content

- Replace placeholder Privacy Policy and Terms copy in `src/pages/PrivacyPolicyPage.vue`, `src/pages/TermsPage.vue`, and `src/features/localization/messages.ts`.
- Cover local-only storage, private notes, no cloud sync, no encryption claim, local notifications, export/share behavior, mock/local AI summaries if kept, and absence of real payments.
- Prepare Google Play Data Safety answers from final behavior, especially local storage, notifications, account data, AI summaries, and export/share.
- Remove wording that says the legal docs are placeholders or internal-testing only from user-facing builds.

### Remove user-facing mock auth flow

- Current affected areas:
  - `src/pages/WelcomePage.vue`
  - `src/pages/SignInPage.vue`
  - `src/pages/SignUpPage.vue`
  - `src/pages/ForgotPasswordPage.vue`
  - `src/pages/AccountPage.vue`
  - `src/shared/api/authApi.ts`
  - `src/app/stores/auth.ts`
- Required decision for local-only MVP:
  - Prefer removing sign-in, sign-up, forgot password, and mock session screens from the user-facing route flow.
  - Keep a simple local-only start path instead.
  - If account routes remain in code for later, hide them from navigation and block direct user-facing use with clear "not available in this build" handling.
- Remove copy such as "Mock auth is active", "Any email and password", placeholder reset messages, and `mock-access-token` behavior from the MVP build path.

### Remove user-facing mock Premium purchase flow

- Current affected areas:
  - `src/pages/UpgradePage.vue`
  - `src/features/subscription/services/subscriptionService.ts`
  - `src/features/subscription/services/mockSubscriptionProvider.ts`
  - `src/features/subscription/subscriptionPlans.ts`
  - `src/app/stores/subscription.ts`
  - `src/features/localization/messages.ts`
- Required MVP behavior:
  - Keep Free/Premium feature locks if useful.
  - Do not show "Start mock Premium", mock plan placeholders, fake renewal dates, or mock restore/manage subscription controls to normal users.
  - If Premium is not sellable yet, show a calm "Premium is not available in this build" or hide the upgrade purchase area.
  - Keep mock Premium only behind a development-only flag or local test harness, not in production/staging user builds.
- Remove or gate local persisted `subscriptionMockState` from user-facing builds.

### Remove debug role and feature test controls

- Current affected areas:
  - `src/pages/SettingsPage.vue`
  - `src/shared/composables/useFeatureAccess.ts`
  - `src/app/stores/userAccess.ts`
- Remove the Settings sections for "Mock workspace role" and "Premium feature checks" from user-facing builds.
- Keep role/access test utilities only behind development-only guards.

### Hide or downgrade Google Calendar sync placeholder

- Current affected areas:
  - `src/pages/CalendarSyncPage.vue`
  - `src/features/calendar/services/calendarService.ts`
  - `src/shared/api/calendarApi.ts`
- Since real OAuth/backend token handling is excluded from this MVP start, do not present Calendar sync as usable.
- Either remove the Calendar Sync route from normal navigation or keep it locked with clear "not available yet" copy.
- Remove user-facing placeholder copy such as "Connection placeholder" from any build users will install.

### Replace placeholder Android artwork and release metadata

- Replace placeholder launcher icons in `android/app/src/main/res/mipmap-*`.
- Replace placeholder splash assets in `android/app/src/main/res/drawable*`.
- Confirm `capacitor.config.ts` splash settings with final artwork.
- Confirm Android `versionName` and `versionCode` in `android/app/build.gradle`.
- Prepare signed release or internal-test build configuration.
- Decide whether `android:allowBackup="true"` in `android/app/src/main/AndroidManifest.xml` is acceptable for sensitive local family data. If not, disable backup or add Android backup/data extraction rules.

### Run real Android QA

- Configure Android Studio and JDK on the release machine.
- Run:
  - `npm run build`
  - `npm run check`
  - `npm run cap:sync`
  - Android debug/release build from Android Studio or Gradle
- Test on at least one small Android phone and one larger Android device/emulator.
- Verify app restart, offline use, local data persistence, keyboard behavior, safe areas, Android back behavior, notification permission denial/grant, and narrow-screen layouts.

## P1 - Should Fix Before Wider MVP Testing

### Replace browser confirms with mobile dialogs or bottom sheets

- Current `window.confirm` usage:
  - `src/pages/MeetingPage.vue`
  - `src/pages/PrivateNotesPage.vue`
  - `src/pages/TasksPage.vue`
- Replace with accessible mobile dialogs/bottom sheets that:
  - Have clear titles and cancel/destructive labels.
  - Trap focus.
  - Restore focus.
  - Close correctly with Android back.

### Remove demo summary fallback for real app routes

- Current affected area:
  - `src/pages/MeetingSummaryPage.vue`
- The mock "Weekly family check-in" summary is useful for design preview, but it should not appear when a real meeting id is missing, locked, or invalid.
- Replace it with proper not-found, locked-history, or empty states.
- Keep any demo data behind a development-only route or story fixture.

### Clean up local mock AI wording

- Current affected areas:
  - `src/features/meeting/aiSummaryService.ts`
  - `src/shared/api/aiApi.ts`
  - `src/pages/MeetingSummaryPage.vue`
  - `src/features/localization/messages.ts`
- If mock/local AI summaries remain for MVP testing, make them product-quality and avoid "placeholder" copy in user-visible responses.
- Keep the disclaimer: "AI summaries may be inaccurate. Review before relying on them."
- Do not market AI as production AI until backend AI exists.

### Complete localization for MVP copy

- Review English, Ukrainian, and Spanish strings after removing mock/placeholder copy.
- Ensure any new fallback strings in components are moved into `src/features/localization/messages.ts`.
- Remove development wording from all locale sections, not only English.

### Review export/share behavior

- Current affected areas:
  - `src/features/export/services/exportService.ts`
  - `src/pages/MeetingDetailsPage.vue`
  - `src/pages/MeetingSummaryPage.vue`
- Confirm private notes are never included by default.
- Confirm AI summaries are included only when visible/allowed.
- Confirm browser print/PDF fallback is acceptable in Capacitor WebView, or hide PDF export until verified.
- Test Android share sheet behavior with plain text and Markdown exports.

### Validate reminders on device

- Current affected areas:
  - `src/features/reminders/reminderService.ts`
  - `src/shared/composables/useNotifications.ts`
  - `src/pages/SettingsPage.vue`
- Test permission prompt timing, denied permission recovery, notification channel creation, repeated weekly scheduling, notification tap behavior, and cancellation when reminders are disabled.
- If Premium purchase is hidden, decide how reminder testing is unlocked in internal builds without exposing mock Premium to users.

### Tighten sensitive local data messaging

- Current affected areas:
  - `src/pages/PrivateNotesPage.vue`
  - `src/shared/services/storageService.ts`
  - legal/settings copy
- Keep "Private notes are stored on this device in the current MVP" visible where relevant.
- Do not imply encryption or cloud backup.
- Add a user-visible local data reset/export backup path only if needed for testing support.

## P2 - Polish Before Public Store Listing

### Update docs and release notes

- Update `README.md` and `docs/android-mvp-release-readiness.md` after deciding which mocked features are hidden or removed.
- Change "internal testing only" statements if the build becomes a public MVP.
- Keep backend/API exclusions documented clearly.

### Improve route access for unfinished features

- Hide routes that are not usable in the MVP start:
  - Account routes if auth is local-only.
  - Calendar sync if OAuth is not available.
  - Upgrade purchase flow if billing is not available.
- Direct URL access should show a calm unavailable state, not a debug placeholder.

### Review app size and route splitting

- `npm run build` currently reports a large main chunk warning.
- This is not a blocker for a narrow MVP, but before public release consider lazy-loading larger routes such as settings, history details, private notes, calendar, and upgrade pages.

## Mocked Or Debug Parts To Remove Or Gate

Remove from user-facing MVP build:

- Mock auth notices and fake account flow:
  - `welcome.mockAuth`
  - `auth.mockSignIn`
  - `auth.mockSignUp`
  - `auth.resetPlaceholder`
  - `account.mockSession`
  - `mock-access-token`
- Mock Premium purchase controls and copy:
  - "Plan placeholders"
  - "Start mock Premium"
  - mock restore/manage subscription behavior
  - mock renewal dates
  - mock Premium plan descriptions
- Settings debug controls:
  - "Mock workspace role"
  - "Premium feature checks"
- Calendar placeholder copy:
  - "Connection placeholder"
  - OAuth/setup placeholder messaging shown as if the feature is usable
- Demo summary data:
  - `mockParticipants`
  - `mockMeetingSummary`
  - mock decisions/actions on real summary routes
- Placeholder legal copy:
  - Privacy Policy placeholder text
  - Terms placeholder text
- Any user-visible "internal testing only", "mock", "placeholder", or "not connected yet" text unless the build is explicitly internal-only.

Can stay if clearly gated or internal-only:

- Local mock AI provider for internal testing, as long as UI does not call it production AI.
- Subscription provider abstraction and mock provider implementation for developer builds.
- Backend DTO/API abstractions under `src/shared/api`.
- Local-only storage service and migrations.
- Premium feature locks.

## Suggested MVP Start Order

1. Decide whether the MVP start is internal-only or user-facing public beta.
2. Remove or gate mock auth, mock Premium, debug settings controls, and Calendar placeholder routes.
3. Replace legal docs and Android artwork.
4. Replace browser confirms with mobile dialogs for destructive actions.
5. Clean up summary not-found/locked states and remove demo data from real routes.
6. Run build/check/cap sync and Android device QA.
7. Update README and release-readiness docs to match the actual build.

## Explicitly Not Included Here

- Real backend API connection.
- Real account sync/auth backend.
- Real cloud data sync.
- Real subscription entitlement validation.
- Real backend AI summary provider.
- Real Google OAuth/token storage.

