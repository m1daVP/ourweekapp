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
plans for next week. Public v1 keeps the flow simple: start a meeting, add notes,
assign tasks, record agreements, finish with a summary, and review unfinished
items next week.

## Release Assets

The Android project must use final branded launcher icons in
`android/app/src/main/res/mipmap-*` and final branded splash assets in
`android/app/src/main/res/drawable*` before public release.

## Release Notes

- App data is local-first unless a feature is explicitly connected to backend
  sync.
- Meetings, tasks, agreements, private notes, settings, onboarding state, and
  development-only mock subscription state are stored through the versioned
  local storage envelope.
- Paid Premium must use trusted backend or store entitlement validation before
  paid features are unlocked.
- Development-only mock billing must not grant production paid access.
- AI summaries are Premium-gated. Production AI summaries require backend API
  support.
- Privacy Policy and Terms screens must be replaced with reviewed legal
  documents before public release.

## Verification Status

- `npm run format`: passed.
- `npm run lint:fix`: passed.
- `npm run build`: passed, including `vue-tsc --noEmit`.
- `npm run check`: passed.
- `npx cap sync android`: passed and copied `dist` into the Android project.
- `npx cap open android`: blocked locally because Android Studio was not found.
- `android/gradlew.bat assembleDebug`: blocked locally because `JAVA_HOME` is
  not set and `java` is not on PATH.

## Public Release Gates

- Replace Privacy Policy and Terms with reviewed legal documents.
- Replace app icon and splash assets with production artwork.
- Install/configure Android Studio and JDK on the release machine, then rerun
  `npx cap open android` and `android/gradlew.bat assembleDebug`.
- Produce and verify a signed release build or AAB.
- Connect real subscription purchase, restore, management, and entitlement
  validation before selling Premium.
- Add backend-supported AI summaries before offering production AI summaries.
- Confirm Google Play Data Safety answers against final backend, billing, AI,
  analytics, and notification behavior.
- Run manual QA on real Android devices, including app restart, offline use,
  notification permission states, and narrow-screen layout.
- Prepare signed release keystore and Play Console testing/release tracks.
