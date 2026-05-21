# Weekly Us

Weekly Us is an Android-first mobile app for guided 15-minute weekly check-ins
for couples and families.

The app helps a household review the week, talk through practical tensions,
assign tasks, record agreements, and carry unfinished follow-ups into the next
weekly meeting. It is designed to feel calm and useful, not like therapy
software and not like a corporate task tracker.

## Product Focus

Weekly Us supports one core ritual:

1. Start a weekly meeting.
2. Review last week.
3. Discuss household topics.
4. Create tasks and agreements.
5. Finish with a clear summary.
6. Review unfinished items next week.

The MVP intentionally avoids generic family-organizer features such as chat,
meal planning, grocery lists, complex budgeting, or calendar management.

## Current MVP Features

- Guided weekly meeting flow
- Default meeting template
- Participant setup
- Notes, tasks, and agreements
- Responsible person assignment
- Meeting history
- Local persistence with basic data versioning
- Free and Premium feature locks
- Mock Premium subscription provider
- Mock AI meeting summaries behind a Premium lock
- Private notes with a local-only storage notice
- Placeholder Privacy Policy and Terms screens
- Android Capacitor project for internal testing

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Capacitor
- Android-first, iOS-ready architecture
- Pinia
- Vue Router
- ESLint
- Prettier
- npm

## Project Structure

```txt
src/
  app/
    router/
    stores/
    App.vue
  pages/
  features/
    access/
    auth/
    calendar/
    export/
    meeting/
    participants/
    private-notes/
    reminders/
    subscription/
    tasks/
    workspace/
  shared/
    api/
    components/
    composables/
    config/
    services/
  styles/
android/
docs/
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the web app in development:

```bash
npm run dev
```

Build the production web bundle:

```bash
npm run build
```

Run quality checks:

```bash
npm run check
```

Format files:

```bash
npm run format
```

## Android Development

The Capacitor app is configured with:

- App name: `Weekly Us`
- App id: `com.weeklyus.app`
- Web output directory: `dist`

Build and sync web assets into Android:

```bash
npm run cap:sync
```

Open the Android project:

```bash
npm run cap:open:android
```

Android Studio and a configured JDK are required for native builds.

## Data and Privacy Notes

The current MVP stores app data locally on the device through a shared storage
service. Meetings, tasks, agreements, participants, settings, private notes,
onboarding state, and mock subscription state are stored in local device
storage.

There is no production backend sync in the current MVP. Do not claim cloud sync
or encryption unless those features are actually implemented.

Private notes are stored on this device in the current MVP.

## Premium and AI Notes

Premium access currently uses a mock subscription provider for development and
internal testing. Real payments are not connected.

AI summaries are Premium-gated and use a local mock provider unless backend API
mode is explicitly enabled. Real AI calls must go through a backend. API keys
must not be placed in the mobile app.

AI summaries may be inaccurate. Review before relying on them.

## Environment Configuration

Backend API behavior is controlled by Vite environment variables:

```txt
VITE_API_BASE_URL=
VITE_API_MODE=mock
VITE_APP_ENV=local
```

If no API base URL is configured, the app uses local/mock behavior where
available.

## Useful Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run check
npm run cap:sync
npm run cap:open:android
```

## Internal Test Readiness

Android MVP release preparation notes are tracked in:

```txt
docs/android-mvp-release-readiness.md
```

This project is prepared for internal testing only. Do not publish to Google
Play production until the remaining production blockers are resolved.

## Production Blockers

- Replace placeholder Privacy Policy and Terms with reviewed legal documents.
- Replace placeholder launcher icon and splash assets with production artwork.
- Configure Android Studio, JDK, signing, and Play Console release setup.
- Run real-device Android QA for restart, offline use, storage, and layout.
- Connect real subscription entitlement validation before selling Premium.
- Add backend-supported AI summaries before offering production AI features.
- Confirm Google Play Data Safety answers against final app behavior.

## Product Tone

Weekly Us should stay calm, practical, and neutral.

Use wording such as:

- "What should we agree on?"
- "Who will take care of this?"
- "Still relevant?"
- "Review unfinished tasks"
- "What felt stressful this week?"

Avoid shame, blame, therapy claims, productivity scoring, or enterprise task
management language.
