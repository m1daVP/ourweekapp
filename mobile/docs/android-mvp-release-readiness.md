# Android MVP Release Readiness

Weekly Us internal test build prep for Android. Do not publish this build to
Google Play production.

## Store Draft

App name: Weekly Us

Package name: `com.weeklyus.app`

Version: `0.1.0` (`versionCode` 1)

Short description:

Guided 15-minute weekly check-ins for couples and families.

Full description draft:

Weekly Us helps couples and families run a calm weekly check-in about what went
well, what felt stressful, household tasks, agreements, purchases, routines, and
plans for next week. The MVP keeps the flow simple: start a meeting, add notes,
assign tasks, record agreements, finish with a summary, and review unfinished
items next week.

## Placeholder Assets

The Android project currently uses placeholder launcher icons in
`android/app/src/main/res/mipmap-*` and placeholder splash assets in
`android/app/src/main/res/drawable*`. Replace them with final branded assets
before public release.

## Internal Testing Notes

- App data is local-only in the current MVP.
- Meetings, tasks, agreements, private notes, settings, onboarding state, and
  mock subscription state are stored through the versioned local storage
  envelope.
- AI summaries are Premium-gated and use the local mock provider unless backend
  API mode is explicitly enabled.
- Billing is a mock provider only. Real Play Billing or a trusted subscription
  backend is not connected.
- Privacy Policy and Terms screens are placeholders for internal testing.

## Verification Status

- `npm run format`: passed.
- `npm run lint:fix`: passed.
- `npm run build`: passed, including `vue-tsc --noEmit`.
- `npm run check`: passed.
- `npx cap sync android`: passed and copied `dist` into the Android project.
- `npx cap open android`: blocked locally because Android Studio was not found.
- `android/gradlew.bat assembleDebug`: blocked locally because `JAVA_HOME` is
  not set and `java` is not on PATH.

## Production Release Blockers

- Replace placeholder Privacy Policy and Terms with reviewed legal documents.
- Replace placeholder app icon and splash assets with production artwork.
- Install/configure Android Studio and JDK on the release machine, then rerun
  `npx cap open android` and `android/gradlew.bat assembleDebug`.
- Connect real subscription entitlement validation before selling Premium.
- Add backend-supported AI summaries before offering real AI summaries.
- Confirm Google Play Data Safety answers against final backend, billing, AI,
  analytics, and notification behavior.
- Run manual QA on real Android devices, including app restart, offline use,
  notification permission states, and narrow-screen layout.
- Prepare signed release keystore and Play Console internal testing track.
