# Google Play Publication Readiness Audit

Audit date: 2026-06-24

## Verdict

OurWeek is suitable for internal or closed testing, but it is **not ready for
public Google Play publication**, especially as a paid Premium product.

## Publication Blockers

### 1. Legal documents are still drafts

The in-app Privacy Policy and Terms explicitly say that ownership, provider,
retention, jurisdiction, billing, and support details must be replaced with
reviewed legal text before public release.

Relevant implementation:

- `src/features/localization/messages.ts`
- `src/pages/PrivacyPolicyPage.vue`
- `src/pages/TermsPage.vue`

### 2. No signed release artifact has been verified

The audit environment did not have a working JDK or Android Studio setup. A
signed release build or Android App Bundle was not produced or verified, and
release signing is not configured in `android/app/build.gradle`.

Required before publication:

- configure Android Studio and a compatible JDK;
- configure and protect the upload keystore;
- enable Play App Signing;
- produce a signed release AAB;
- install or distribute that exact artifact through a Play testing track;
- verify startup, upgrades, storage, and native integrations from the release
  artifact.

### 3. Paid Premium is incomplete

Production billing remains marked as TODO in the subscription service.
Subscription plans can fall back to `Price pending`, and the audited local
release configuration had RevenueCat entitlement validation disabled.

Purchase, restore, management, and trusted backend entitlement validation have
not been demonstrated end to end.

Relevant implementation:

- `src/features/subscription/services/subscriptionService.ts`
- `src/features/subscription/services/revenueCatSubscriptionProvider.ts`
- `src/features/subscription/subscriptionPlans.ts`
- `src/shared/config/env.ts`

Google Play Billing is generally required when selling Premium app
functionality or other digital services in an app distributed through Google
Play:

- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/10281818)

### 4. Production backend readiness is unverified

The backend URL configured in the local environment was unreachable during a
read-only health check. The passing frontend tests use mocks and contract
snapshots; they do not prove the live behavior of:

- account registration and authentication;
- token refresh and logout;
- synchronization and conflict handling;
- account export and deletion;
- billing validation;
- AI summaries;
- Google Calendar OAuth and synchronization.

The production backend and all required providers need health checks,
integration tests, observability, retention rules, and failure-path QA before
publication.

### 5. Privacy, Data Safety, and account deletion compliance are incomplete

The repository contains a draft Data Safety document, but the audit found no
evidence of a completed Play Console declaration, a reviewed public privacy
policy URL, or the external web resource required for account deletion
requests.

The app includes an in-app account deletion path. Google Play also requires an
external web link where users can request deletion of their account and
associated data:

- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play Data Safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469)

Final declarations must cover the production backend and all third-party SDKs,
including RevenueCat, AI providers, Calendar integration, notification
behavior, and any future analytics or crash reporting.

### 6. Android backup behavior needs a privacy decision

`android:allowBackup="true"` is enabled in
`android/app/src/main/AndroidManifest.xml`. Meetings, tasks, agreements, and
private notes use local app storage.

Before release, either:

- disable backup for the application; or
- define and test explicit backup/data-extraction rules that exclude sensitive
  data; or
- approve the intended backup behavior and disclose it accurately.

The current state risks conflicting with local-only expectations for sensitive
household information and private notes.

### 7. A reproducible production configuration is missing

The audited build used a local environment configuration that enabled backend
mode and Google Calendar while RevenueCat validation was disabled. This can
produce a technically successful build with an invalid public-release feature
set.

A release process should fail when required production settings are absent or
inconsistent. It should verify at least:

- `VITE_APP_ENV=production`;
- a reviewed HTTPS API base URL;
- trusted subscription validation;
- final RevenueCat entitlement, offering, and Play product identifiers;
- Google Calendar disabled unless its backend OAuth flow and disclosures are
  approved;
- no development-only provider or copy is exposed.

### 8. Real-device and Play Console verification is missing

The following still require verification from the actual release artifact:

- Android hardware and gesture back behavior;
- notification permission granted, denied, and permanently denied states;
- reminder scheduling and notification taps;
- offline startup and recovery;
- app restart and local data persistence;
- keyboard behavior and form visibility;
- small and large Android screen layouts;
- account lifecycle and deletion cleanup;
- purchase, restore, management, and entitlement refresh;
- AI summary error and timeout handling;
- Google Calendar connect, disconnect, revoke, and sync behavior;
- Play pre-launch report;
- store listing, screenshots, feature graphic, content rating, and policy
  declarations.

For personal developer accounts created after 2023-11-13, Google may require a
closed test with at least 12 opted-in testers for 14 continuous days before
production access:

- [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)

## Additional Findings

### Remote font loading

`src/styles/main.css` imports fonts and Material Symbols from Google Fonts at
runtime. This creates an external request during app use, may affect offline
presentation, and should be included in the privacy/Data Safety review. For a
mobile release, bundling required font assets locally would provide more
predictable offline and privacy behavior.

### Release documentation mismatch

`docs/android-mvp-release-readiness.md` describes version `0.1.0`, while
`package.json` and the Android project use version `0.3.0`. Store documentation
and release metadata should have one source of truth.

### Android assets require final approval

Branded launcher and splash artwork exists and is visually coherent, but the
release-readiness document still identifies these assets as temporary. Product
and store-asset approval is therefore still an open release gate.

### Bundle size

The production build succeeds, but Vite reports a JavaScript chunk larger than
500 kB after minification. This is not a publication blocker, but route-level
code splitting should be considered before or soon after v1.

### Dependency audit

- Production dependencies: 0 known vulnerabilities from `npm audit --omit=dev`.
- Development tooling: 6 high and 2 moderate findings, primarily through
  `@capacitor/assets`, `tar`, `minimatch`, and `uuid`.
- The high-severity findings reported no available fix at audit time; the
  moderate `uuid` issue reported an available npm fix.

These findings affect development/release tooling rather than the shipped
runtime, but should be tracked and reviewed before running asset tooling on
untrusted input.

## Checks That Passed

- `npm run build`
- `npm run check`
- 22 test files passed
- 130 tests passed
- production dependency audit reported 0 vulnerabilities
- Android target SDK is 36
- compile SDK is 36
- minimum SDK is 24
- package name is `com.ourweek.app`
- manifest permissions are limited to Internet and notifications in the
  checked source manifest
- mobile browser smoke tests at 390 x 844 and 320 x 568 showed no horizontal
  overflow
- primary launch and sign-up controls had appropriate mobile sizing

Google Play currently requires new apps and updates to target Android 15/API 35
or higher. The project target SDK of 36 satisfies that technical requirement:

- [Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk)

## Recommended Release Sequence

1. Finalize the production feature scope. Disable anything that will not be
   operational on launch.
2. Finalize the backend contract and deploy a reachable production/staging
   environment.
3. Complete RevenueCat and Google Play product configuration plus trusted
   backend entitlement validation.
4. Replace draft legal text and publish the privacy and account-deletion web
   resources.
5. Resolve Android backup behavior and remote font loading.
6. Create a validated production environment configuration and add release
   configuration checks.
7. Configure JDK, Android Studio, signing, Play App Signing, and generate the
   signed AAB.
8. Run internal testing and the Play pre-launch report.
9. Run real-device QA using the release artifact.
10. Complete Data Safety, content rating, app access instructions, subscription
    declarations, and store listing assets.
11. Run the required closed testing period if it applies to the developer
    account.
12. Re-audit the exact release commit and signed artifact before production
    rollout.

## Publication Recommendation

Proceed with an **internal or closed testing release only**. Do not publish to
the public production track or sell Premium until the legal, backend, billing,
signed AAB, privacy/Data Safety, backup-policy, and real-device QA gates above
are complete.
