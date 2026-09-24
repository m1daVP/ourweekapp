# Android Release Readiness

OurWeek public v1 release preparation for Android.

## Store Draft

App name: OurWeek

Package name: `com.ourweek.app`

Version: `0.1.0` (`versionCode` 1)

Short description:

Guided 15-minute weekly check-ins for couples and families.

Full description draft:

OurWeek helps couples and families run a calm weekly check-in about what went
well, what felt stressful, household tasks, agreements, purchases, routines, and
plans for next week. Public v1 keeps the flow simple and complete: create an
account, start a meeting, add notes, assign tasks, record agreements, finish
with a summary, review unfinished items next week, sync household records,
manage Premium, use reminders, export meeting records, and connect Google
Calendar when the verified production integration is enabled.

## Release Assets

The Android project must use final branded launcher icons in
`android/app/src/main/res/mipmap-*` and final branded splash assets in
`android/app/src/main/res/drawable*` before public release.

## Scope And Release Notes

- Public v1 scope is locked in `docs/public-v1-feature-scope.md`.
- App data is local-first and backend-backed where launch sync is implemented.
  Meetings, tasks, agreements, participants, workspace records, account data,
  and subscription state must match the production backend contract.
- Private notes remain local-only unless a reviewed sync design is implemented.
- Paid Premium must use trusted backend or store entitlement validation before
  paid features are unlocked.
- Development-only billing or entitlement test providers must not grant
  production paid access.
- AI summaries are Premium-gated and generated through the backend in
  production.
- Google Calendar sync is part of public v1 scope and must stay hidden in
  production until the backend OAuth, token storage, disconnect/revoke, and Data
  Safety review are complete.
- Privacy Policy and Terms screens must be replaced with reviewed legal
  documents before public release.

## Verification Status

- `npm run format`: passed.
- `npm run lint:fix`: passed.
- `npm run build`: passed, including `vue-tsc --noEmit`.
- `npm run check`: passed.
- `npm audit --audit-level=moderate`: reports transitive dev-tooling
  vulnerabilities through `@capacitor/assets`/Capacitor asset generation
  dependencies (`tar`, `minimatch`, `uuid`). `uuid` may be fixable by npm when
  registry access is available; the high-severity `@capacitor/assets`
  transitive findings reported no available fix during review.
- `npx cap sync android`: passed and copied `dist` into the Android project.
- `npx cap open android`: blocked locally because Android Studio was not found.
- `android/gradlew.bat assembleDebug`: blocked locally because `JAVA_HOME` is
  not set and `java` is not on PATH.

## Public Release Gates

- Replace Privacy Policy and Terms with reviewed legal documents. Draft
  API-backed disclosure copy is now in the app, with supporting data maps in
  `docs/privacy-data-map.md` and `docs/google-play-data-safety.md`; final legal
  review is still required before public release.
- Replace app icon and splash assets with production artwork.
- Install/configure Android Studio and JDK on the release machine, then rerun
  `npx cap open android` and `android/gradlew.bat assembleDebug`.
- Produce and verify a signed release build or AAB.
- Connect real subscription purchase, restore, management, and entitlement
  validation before selling Premium.
- Add backend-supported AI summaries before offering production AI summaries.
- Enable Google Calendar sync only after backend-supported Google OAuth,
  backend token storage, disconnect/revoke handling, and Data Safety disclosures
  are verified.
- Confirm Google Play Data Safety answers against final backend, billing, AI,
  analytics, and notification behavior.
- Run manual QA on real Android devices, including app restart, offline use,
  notification permission states, and narrow-screen layout.
- Prepare signed release keystore and Play Console testing/release tracks.
