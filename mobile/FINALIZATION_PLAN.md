# Finalization Plan For Real Launch

Audit date: 2026-06-14

Scope: this plan covers the work required before OurWeek can be used by real
users in a public Android launch. This plan assumes the current v1 feature set
remains in scope. There is no "hide it for MVP" fallback in this plan: every
feature exposed by the product, navigation, store listing, legal copy, or
release notes must work in production.

## Launch Rule

OurWeek is launch-ready only when:

- real users can create accounts, use the weekly meeting flow, sync data, buy
  and restore Premium, generate AI summaries, use reminders, export data, use
  private notes, manage account data, and connect Google Calendar without mock
  behavior;
- all paid features are unlocked only through trusted backend or store
  entitlement validation;
- no production screen relies on mock auth, mock billing, placeholder AI,
  placeholder Calendar behavior, placeholder legal copy, or debug controls;
- backend-backed features fail gracefully when offline or unavailable without
  deleting local user data;
- the signed Android build has passed real-device QA;
- Google Play listing, Data Safety, subscription setup, OAuth consent, legal
  docs, and support materials match the real shipped behavior.

## P0 - Must Finish Before Final User Testing

### 1. Lock Production Feature Scope ✅

- Confirm every feature listed in the app and store copy is included in the
  real launch:
  - guided weekly meeting flow;
  - participant setup;
  - notes, tasks, agreements, and responsibility assignment;
  - meeting history;
  - backend auth and secure session handling;
  - backend sync for meetings, tasks, agreements, participants, and workspace;
  - Free and Premium access rules;
  - real Premium purchase, restore, management, and entitlement validation;
  - backend AI summaries;
  - private notes with local-only behavior;
  - local reminders;
  - export;
  - Google Calendar sync;
  - account export and deletion;
  - workspace/member basics.
- Remove "MVP hidden", "coming soon", "not connected", "mock", and
  "placeholder" assumptions from release planning.
- Align `README.md`, `docs/android-mvp-release-readiness.md`, in-app legal
  screens, and Google Play copy with the final scope.

Acceptance criteria:

- A release reviewer can open every navigation item and complete the related
  workflow.
- Store copy does not advertise anything unavailable.
- No user-facing production copy says a feature is mocked, placeholder, or
  disabled for MVP.

### 2. Finish Backend Environment And API Contract

- Deploy a staging and production backend with HTTPS URLs.
- Set `VITE_API_BASE_URL` to the production HTTPS API origin. Backend access is
  mandatory and Calendar uses the backend without a feature switch.
- Keep API versioning stable under `/v1`.
- Keep structured error responses consistent:
  - `message`;
  - `code`;
  - `details`.
- Reconcile duplicate subscription surfaces:
  - frontend currently uses `/v1/subscriptions/*`;
  - backend also exposes `/v1/billing/*`;
  - choose one public contract and document whether the other remains an alias.
- Decide whether `/v1/exports/meeting` is part of the production flow or
  whether export remains device-side.
- Refresh OpenAPI fixtures and contract tests from the final backend.

Acceptance criteria:

- `npm run test:api:live` passes against staging and production-like backend.
- `/health`, `/health/live`, and `/health/ready` return expected statuses.
- `/health/ready` includes all launch-critical dependencies, not only database,
  if AI, billing, email, or Calendar providers can block launch behavior.

### 3. Complete Real Auth And Account Lifecycle ✅

- Verify real backend behavior for:
  - `POST /v1/auth/register`;
  - `POST /v1/auth/sign-in`;
  - `POST /v1/auth/refresh`;
  - `POST /v1/auth/sign-out`;
  - `GET /v1/auth/me`;
  - password reset request and confirmation.
- Confirm refresh-token rotation, expiry, logout, and forced re-auth behavior.
- Keep access and refresh tokens in secure storage on native platforms.
- Confirm no token, password reset token, or auth error detail is written to:
  - local app data;
  - Capacitor Preferences;
  - exports;
  - logs;
  - support diagnostics;
  - user-visible raw errors.
- Decide and implement local data behavior after account deletion:
  - keep local data and explain it clearly; or
  - offer local cleanup as a separate confirmed action; or
  - delete local data as part of account deletion.

Acceptance criteria:

- Account creation, sign-in, session refresh, logout, password reset, account
  export, and account deletion all pass manual and automated tests.
- A deleted account cannot continue using backend-backed Premium or synced data.

### 4. Finish Cloud Sync For Core Data

- Verify sync for:
  - meetings;
  - meeting sections;
  - notes;
  - tasks;
  - agreements;
  - review decisions;
  - participants;
  - workspace/member basics.
- Confirm offline-first writes continue locally and sync later.
- Confirm initial migration from existing local-only data to an account.
- Confirm conflict handling is deterministic and user-safe.
- Confirm failed sync never deletes local user data.
- Confirm server revision, client timestamps, deleted records, and schema
  versions behave consistently.
- Confirm private notes remain excluded from backend sync unless a reviewed sync
  design is implemented.

Acceptance criteria:

- Multi-device sync works for a real account.
- Offline create/edit/delete flows recover after reconnect.
- Conflict tests cover same-record edits from two devices.
- Local backup/recovery path is verified before first sync.

### 5. Implement Real Premium Billing

- Choose and implement the production billing path:
  - RevenueCat with `@revenuecat/purchases-capacitor`; or
  - direct Google Play Billing behind the existing provider abstraction.
- Configure Google Play subscription products:
  - monthly Premium product;
  - yearly Premium product;
  - one `premium` entitlement.
- Replace the current native billing stub in
  `src/features/subscription/services/nativeBillingService.ts`.
- Validate purchase tokens through the backend or trusted entitlement provider.
- Implement restore purchases on Android.
- Implement manage-subscription links or native store management handoff.
- Confirm backend subscription status is the source of truth.
- Confirm local frontend state can never grant production Premium by itself.
- Confirm entitlement refresh on:
  - app launch;
  - sign-in;
  - purchase completion;
  - restore;
  - failed validation;
  - subscription expiry/cancellation.

Acceptance criteria:

- A real Play test purchase unlocks Premium only after trusted validation.
- Restore works after reinstall and sign-in.
- Expired or refunded subscriptions lose Premium access.
- Purchase failure and cancellation show calm recovery copy.

### 6. Complete Backend AI Summaries

- Verify `POST /v1/ai/meeting-summary` uses backend AI only.
- Confirm mobile app contains no provider API keys.
- Confirm server-side Premium enforcement before generation.
- Confirm AI prompts exclude private notes by default.
- Confirm generated summaries are:
  - short;
  - neutral;
  - practical;
  - non-judgmental;
  - not therapy or diagnosis.
- Add backend rate limiting and abuse protection.
- Define backend logging and retention for prompts/responses.
- Confirm timeout, 429, 500, and 503 states keep the normal meeting summary
  usable.

Acceptance criteria:

- Free users cannot generate AI summaries.
- Premium users can generate and regenerate summaries.
- AI failure does not block access to tasks, agreements, or the normal meeting
  summary.
- The AI disclaimer is visible where the summary is generated or shown.

### 7. Complete Google Calendar Sync

- Implement backend-supported Google OAuth for production.
- Store Google access and refresh tokens only on the backend.
- Add native-safe OAuth handoff and return behavior.
- Add Android intent filters or app-link/deep-link handling if required by the
  final OAuth redirect design.
- Implement and verify:
  - connection status;
  - connect;
  - callback handling;
  - disconnect;
  - revoke behavior where required;
  - meeting reminder sync;
  - task due date sync;
  - follow-up date sync.
- Define exact Google OAuth scopes and show them in consent/legal review.
- Confirm Data Safety and privacy copy match the actual Google data flow.

Acceptance criteria:

- A real Google account can connect and disconnect on Android.
- Synced calendar items are created or updated correctly.
- Disconnect stops future sync and handles token revocation policy.
- Calendar sync errors do not block core OurWeek data.

### 8. Finish Private Notes Behavior

- Keep private notes local-only unless a reviewed sync design is added.
- Keep the local-only notice visible.
- Confirm private notes are excluded by default from:
  - meeting export;
  - account export, unless explicitly designed otherwise;
  - AI summaries;
  - support diagnostics;
  - backend sync.
- Confirm no copy implies encryption unless encryption is implemented.
- Verify private notes persist across app restart and survive unrelated sync
  failures.

Acceptance criteria:

- Private notes remain on device during backend sync tests.
- Export and diagnostics do not contain private note content.

### 9. Complete Reminders And Local Notifications

- Verify permission prompt timing on Android.
- Verify denied permission handling.
- Verify reminder scheduling, cancellation, update, and weekly repeat behavior.
- Verify notification channels.
- Verify notification tap behavior.
- Confirm reminders are Premium-gated through real entitlement.
- Confirm reminders use calm wording and do not say "overdue".

Acceptance criteria:

- Permission denied, granted, and system-blocked states work on real Android.
- Disabling reminders cancels scheduled notifications.
- Losing Premium cancels or blocks reminder scheduling.

### 10. Complete Export

- Confirm supported launch formats:
  - text;
  - Markdown;
  - PDF only if fully verified in Capacitor WebView.
- Decide whether production export uses local generation, `/v1/exports/meeting`,
  or both.
- Confirm private notes are excluded by default.
- Confirm AI summaries are included only when visible and allowed.
- Verify Android share sheet and file save behavior.
- Verify export filenames, MIME types, and non-ASCII content.

Acceptance criteria:

- Meeting export works on Android after restart and offline.
- Shared/exported files contain no private notes by default.

### 11. Finish Workspace And Participant Flows

- Verify workspace read/update.
- Verify inviting an adult member or partner.
- Verify member role update and member removal.
- Keep roles simple:
  - Owner;
  - Adult member / Partner;
  - Viewer only if fully supported;
  - Child profile only as a participant/profile, not a real login unless fully
    implemented.
- Confirm role permissions are enforced by backend and frontend.
- Remove or dev-gate role-switch test controls from production.

Acceptance criteria:

- Owner and adult member flows work end to end.
- Unauthorized workspace actions return user-friendly errors.

### 12. Fix Localization And Product Copy

- Fix rotated locale strings in `src/features/localization/messages.ts`.
- Review English, Ukrainian, and Spanish copy for all launch flows.
- Remove user-facing mock/debug/internal-only language from production builds.
- Confirm all visible strings are translation-ready.
- Confirm product tone remains calm, practical, and neutral.
- Confirm no screen uses therapy, blame, shame, scoring, or productivity-guru
  language.

Acceptance criteria:

- Password reset and account-required copy appears in the selected language.
- A production build has no visible "mock", "placeholder", "internal testing",
  or "not connected yet" copy.

### 13. Replace Draft Legal And Store Disclosures

- Replace Privacy Policy and Terms with reviewed legal documents.
- Fill final details:
  - legal entity;
  - support contact;
  - jurisdiction;
  - effective date;
  - data retention;
  - account deletion behavior;
  - local data behavior;
  - subscription provider;
  - AI provider;
  - Google OAuth scopes;
  - diagnostics/analytics/crash reporting if added.
- Finalize `docs/privacy-data-map.md`.
- Finalize `docs/google-play-data-safety.md`.
- Confirm Google Play Data Safety answers against actual runtime behavior.
- Confirm store subscription disclosure requirements.

Acceptance criteria:

- Legal copy has been reviewed and approved.
- Store listing, Data Safety, app behavior, and backend behavior do not
  contradict each other.

## P1 - Must Finish Before Public Release Candidate

### 14. Android Release Configuration

- Install/configure:
  - JDK;
  - Android Studio;
  - Android SDK;
  - Gradle/Android Gradle Plugin compatibility;
  - `adb`.
- Confirm Android package:
  - `com.ourweek.app`.
- Confirm versioning:
  - `versionCode`;
  - `versionName`.
- Configure signed release keystore and secure key handling.
- Produce signed release APK or AAB.
- Decide Android backup behavior for sensitive local household data:
  - disable `android:allowBackup`; or
  - add reviewed backup/data extraction rules.
- Replace launcher icon and splash assets with final production artwork.
- Verify splash screen and app icon on real devices.

Acceptance criteria:

- Signed AAB builds reproducibly on the release machine.
- The signed build installs cleanly on Android devices.
- Backup behavior is documented and matches privacy copy.

### 15. Security And Privacy Hardening

- Confirm no secrets are committed or bundled.
- Confirm `.env` files remain ignored.
- Verify no `VITE_` variable contains secrets.
- Verify auth tokens use secure storage.
- Verify Google tokens are never stored in the app.
- Verify payment data and receipts are not logged or exported.
- Verify support diagnostics are redacted and contain technical status only.
- Review all logging and error surfaces.
- Avoid raw backend errors in user-facing copy.
- Review all uses of browser storage.

Acceptance criteria:

- A release scan finds no API keys, OAuth tokens, payment tokens, or backend
  secrets in source, build output, logs, or exported diagnostics.

### 16. Dependency And Supply Chain Review

- Run:
  - `npm audit --audit-level=moderate`;
  - dependency license review if required.
- Resolve or document current audit findings from dev tooling dependencies:
  - `@capacitor/assets`;
  - `@capacitor/cli`;
  - `tar`;
  - `minimatch`;
  - `uuid`.
- Apply safe package updates where available.
- Confirm no new large or unmaintained dependencies were added for launch.

Acceptance criteria:

- Audit findings are either fixed or explicitly accepted with rationale because
  they affect dev tooling only and not shipped runtime code.

### 17. Performance And Bundle Review

- Address Vite large chunk warning by route splitting where practical.
- Lazy-load heavier route pages:
  - auth pages;
  - settings;
  - history details;
  - private notes;
  - Calendar sync;
  - Upgrade;
  - workspace settings.
- Check startup time on low and mid-range Android devices.
- Keep animations short and respect reduced motion.

Acceptance criteria:

- App startup and route transitions feel responsive on real devices.
- Build has no unexplained large bundle regression.

### 18. Accessibility And Mobile UX QA

- Verify large tap targets.
- Verify form labels and validation messages.
- Verify focus management for:
  - bottom sheets;
  - confirmation dialogs;
  - popups;
  - menus.
- Verify Android back priority:
  - popup;
  - bottom sheet;
  - modal/dialog;
  - drawer if introduced;
  - router history;
  - app exit/minimize only from root.
- Verify keyboard behavior in meeting, auth, participant, task, agreement, and
  private note forms.
- Verify small-screen and large-phone layouts.

Acceptance criteria:

- Core flows can be completed with touch and keyboard/focus navigation.
- No critical action is hidden under Android system navigation or keyboard.

## P2 - Final Verification Before Real Users

### 19. Automated Verification

Run on a clean checkout:

```bash
npm install
npm run build
npm run check
npm test
npm run test:api:live
npm run cap:sync
```

Then run Android native build verification:

```bash
android/gradlew.bat assembleDebug
android/gradlew.bat bundleRelease
```

Acceptance criteria:

- All commands pass on the release machine.
- Generated native artifacts are archived with version, commit, and environment
  metadata.

### 20. Backend End-To-End Test Matrix

Verify with real staging services:

- sign up;
- sign in;
- refresh session;
- password reset;
- logout;
- account export;
- account deletion;
- workspace create/update;
- invite/member flow;
- participant sync;
- meeting create/edit/finish/sync;
- task and agreement sync;
- conflict resolution;
- Premium purchase;
- restore purchase;
- entitlement expiry/cancel/refund;
- AI summary generation;
- AI error/rate limit;
- Calendar connect/disconnect/sync;
- export/share;
- offline and reconnect.

Acceptance criteria:

- Every critical workflow has a documented pass/fail result.
- Any failed test has an owner and fix before release candidate approval.

### 21. Real Android Device QA

Test at minimum:

- one small Android phone;
- one larger Android phone;
- one current Android version;
- one older supported Android version;
- fresh install;
- app update if updating existing testers;
- offline launch;
- app restart;
- process kill and restore;
- keyboard-heavy flows;
- notification permission denied/granted;
- Google OAuth return;
- Play Billing test purchase;
- share sheet/export;
- narrow screen layout;
- safe areas and gesture navigation.

Acceptance criteria:

- No P0 or P1 device issues remain open.

### 22. Play Console Release Preparation

- Create/verify app listing.
- Upload final icon, feature graphic, screenshots, and descriptions.
- Configure subscription products.
- Configure internal/closed testing track.
- Configure Data Safety.
- Configure content rating.
- Configure privacy policy URL.
- Configure support contact.
- Configure OAuth consent and verified domains if Calendar ships.
- Upload signed AAB.
- Prepare release notes.

Acceptance criteria:

- Internal/closed testing release is approved and installable.
- Billing and OAuth flows work from the Play-distributed build.

## Final Launch Gate

Do not release to real users until every item below is true:

- [ ] Production backend is deployed, monitored, and healthy.
- [ ] Auth and account lifecycle are production-ready.
- [ ] Core data sync is production-ready and tested across devices.
- [ ] Real Premium purchase, restore, management, and entitlement validation
      work.
- [ ] Backend AI summaries work with server-side Premium checks.
- [ ] Google Calendar sync works with backend OAuth and reviewed disclosures.
- [ ] Private notes remain local-only and excluded by default from export, AI,
      diagnostics, and sync.
- [ ] Local reminders work on real Android devices.
- [ ] Export works on real Android devices.
- [ ] Workspace/member basics work and permissions are enforced.
- [ ] Localization is corrected and reviewed.
- [ ] Privacy Policy and Terms are final reviewed documents.
- [ ] Google Play Data Safety matches actual behavior.
- [ ] Production app icon and splash assets are final.
- [ ] Android backup behavior is decided and implemented.
- [ ] Signed release AAB is produced and verified.
- [ ] Real-device QA is complete.
- [ ] Automated checks pass on a clean release machine.
- [ ] Dependency audit findings are fixed or accepted with written rationale.
- [ ] No production-visible mock, placeholder, debug, or internal-only copy
      remains.
