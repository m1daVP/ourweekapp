# OurWeek

**A calmer weekly check-in for couples and families.**

OurWeek guides a short household conversation: review the past week, talk about
what matters, agree on next steps, and carry unfinished work into the next
meeting. The goal is a useful 15-minute ritual.

This repository contains the Vue/Capacitor mobile app. The separate
OurWeek API repository contains the
Fastify service and database migrations. Both are needed to run the connected
app.

## What the app does

1. Start a guided weekly meeting and choose the participants.
2. Capture discussion points, tasks, and agreements.
3. Review the meeting recap and follow through during the week.
4. Return next week with prior work and meeting history available.

The app also includes local reminders, exports, account/workspace sync,
Premium access, backend-generated AI recaps, and Google Calendar integration.
Native purchases use RevenueCat; the API checks entitlements before granting
paid access. Provider-backed features require their own configuration and
accounts to exercise end to end.

Private notes remain on the device. AI recaps should be reviewed by a person
before relying on them.

## Stack and repository map

- Vue 3, TypeScript, Vite, Pinia, Vue Router, and Vue I18n
- Capacitor projects under `android/` and `ios/`
- RevenueCat Capacitor SDK for native purchases
- `src/features/` for product areas; `src/shared/` for API, config, and common services

The backend handles authentication, workspace data, billing verification,
calendar OAuth, AI calls, and sync. See the API README for its setup and
API documentation.

## Run locally

**Requirements:** Node.js 24, npm, and a running OurWeek API. Docker and the
Supabase CLI are needed if you run the backend database locally. Android Studio
and a JDK are needed for an Android build; Xcode is needed for iOS.

1. Start the API using its local setup instructions.
2. In this repository, install dependencies and create a local configuration:

   ```sh
   npm ci
   cp .env.example .env
   ```

   Set `VITE_API_BASE_URL` in `.env` to the API origin. The backend example
   listens on `http://localhost:3000`; update the frontend example's
   `localhost:3030` value if you use that default. The Vite server uses port
   `3007`, so add `http://localhost:3007` to the API's
   `CORS_ALLOWED_ORIGINS` for browser development. For an emulator or physical
   phone, use an address it can reach instead of the computer's `localhost`.

3. Start the Vite development server:

   ```sh
   npm run dev
   ```

   Open the URL printed by Vite to inspect the app in a browser. Native
   behavior, including purchases and local notifications, needs a device or
   emulator.

4. For Android, build the web assets, sync Capacitor, then open the project:

   ```sh
   npm run cap:sync
   npm run cap:open
   ```

   For iOS, use `npm run cap:sync:ios` and open `ios/App/App.xcworkspace`
   in Xcode.

On PowerShell, use `Copy-Item .env.example .env` in place of `cp`.

## Configuration and release builds

The checked-in `.env.example` documents local configuration.
`.env.release.example` documents the public values required for a release.
Values beginning with `VITE_` are bundled into the app and must never contain
server secrets. The backend keeps Supabase service-role credentials, provider
keys, webhook secrets, and signing secrets.

A release build uses Vite's `release` mode and validates its required public
settings:

```sh
cp .env.release.example .env.release.local
# Replace example values with your own public configuration.
npm run build:prod
```

`npm run cap:sync:prod` packages the production web build for Android and
iOS. Native purchases, Google sign-in, Sentry upload, and other external
integrations need the corresponding provider setup. Keep local environment
files, signing material, and credentials out of Git.

## Verify the source

```sh
npm run typecheck
npm test
npm run check
npm run build
```

CI runs the combined `npm run ci` check with a synthetic API URL. The app's
[release scope](docs/public-v1-feature-scope.md) and
[Android release notes](docs/android-mvp-release-readiness.md) provide more
detail about behavior and device validation.

## License

Source code in this repository is licensed under the
[Mozilla Public License 2.0](LICENSE).
