# OurWeek

OurWeek is an Android-first mobile app for guided 15-minute weekly check-ins
for couples and families.

The app helps a household review the week, talk through practical tensions,
assign tasks, record agreements, and carry unfinished follow-ups into the next
weekly meeting. It is designed to feel calm and useful, not like therapy
software and not like a corporate task tracker.

## Product Focus

OurWeek supports one core ritual:

1. Start a weekly meeting.
2. Review last week.
3. Discuss household topics.
4. Create tasks and agreements.
5. Finish with a clear summary.
6. Review unfinished items next week.

Public v1 intentionally avoids generic family-organizer features such as chat,
meal planning, grocery lists, complex budgeting, or calendar management.

## Public V1 Scope

- Guided weekly meeting flow
- Default and additional meeting templates
- Participant setup
- Notes, tasks, and agreements
- Responsible person assignment
- Meeting history with Free and Premium access rules
- Backend auth and secure session handling
- Backend sync for meetings, tasks, agreements, participants, and workspace
- Local persistence with basic data versioning
- Real Premium purchase, restore, management, and entitlement validation
- Backend AI meeting summaries
- Private notes with a local-only storage notice
- Local reminders
- Meeting export
- Account export and deletion
- Google Calendar sync
- Workspace/member basics
- Free and Premium feature locks
- Android-first Capacitor app prepared for release builds

Public v1 scope is locked in `docs/public-v1-feature-scope.md`. Features listed
in app navigation, store copy, release notes, or legal copy must be complete for
production launch and must not be described as test-only, draft, or hidden from
release. Calendar sync always uses the configured backend OAuth flow.

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

- App name: `OurWeek`
- App id: `com.ourweek.app`
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

OurWeek stores app data locally on the device and syncs selected account,
workspace, meeting, task, agreement, and participant data in backend API mode.
Meetings, tasks, agreements, participants, settings, private notes,
and onboarding state are stored through the shared local storage service.

Sensitive auth tokens must use secure token storage when auth or backend API
mode is enabled. Do not store access tokens, refresh tokens, OAuth tokens, API
keys, payment data, or other secrets in local storage, Capacitor Preferences,
logs, exports, or user-visible errors.

Do not claim encryption unless it is implemented. Cloud sync claims must match
the backend-backed behavior that is actually connected and tested.

Private notes are stored on this device unless a reviewed sync design is
implemented.

## Premium and AI Notes

Paid Premium must not rely on frontend-only state in production. Production
Premium entitlement must come from trusted backend or store validation before
paid features are unlocked.

Native purchases use RevenueCat and every entitlement is validated by the
backend before Premium access is granted.

AI summaries are Premium-gated. Production AI summaries must go through the
backend. API keys must not be placed in the mobile app.

AI summaries may be inaccurate. Review before relying on them.

## Environment Configuration

The backend is required for every app run:

```txt
VITE_API_BASE_URL=http://localhost:3030
```

Development and builds fail immediately when `VITE_API_BASE_URL` is missing or
invalid. Local HTTP is accepted for development; public release builds require
a public HTTPS backend URL.

Public release builds use the strict production configuration gate:

```bash
copy .env.release.example .env.release.local
npm run build:production
```

The build fails unless a public HTTPS backend and explicit Android
RevenueCat/product identifiers are
configured. The validator reports variable names and corrective actions but
does not print their values. `npm run cap:sync:production` applies the same gate
before syncing Android.

Google Calendar sync always uses the backend for OAuth, token handling, sync,
disconnect, and revoke behavior.

Never put secrets in Vite environment variables. Values exposed through Vite are
bundled into the mobile/web app.

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

## Release Readiness

Android release preparation notes are tracked in:

```txt
docs/android-mvp-release-readiness.md
```

The app is being prepared for a public v1 release with paid Premium. Do not
publish a paid release until the release gates below are resolved.

## Before Public Release

- Replace draft Privacy Policy and Terms with reviewed legal documents.
- Replace temporary launcher icon and splash assets with production artwork.
- Configure Android Studio, JDK, signing, and Play Console release setup.
- Produce and verify a signed Android release build or AAB.
- Run real-device Android QA for restart, offline use, storage, and layout.
- Connect real subscription purchase, restore, management, and entitlement
  validation before selling Premium.
- Add backend-supported AI summaries before offering production AI features.
- Confirm Google Play Data Safety answers against final app behavior.

## Product Tone

OurWeek should stay calm, practical, and neutral.

Use wording such as:

- "What should we agree on?"
- "Who will take care of this?"
- "Still relevant?"
- "Review unfinished tasks"
- "What felt stressful this week?"

Avoid shame, blame, therapy claims, productivity scoring, or enterprise task
management language.
