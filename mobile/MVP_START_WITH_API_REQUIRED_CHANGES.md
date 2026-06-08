# MVP Start Required Changes With API Integrations

Audit date: 2026-06-04

Scope: this checklist covers what is still needed for a production-capable MVP start that includes real API integrations. It builds on `MVP_START_REQUIRED_CHANGES.md`, but includes backend/API work for auth, sync, AI summaries, subscriptions, and Google Calendar.

## Definition Used For This Audit

- The app must not rely on mock auth, mock Premium purchases, local-only AI, or placeholder Google Calendar behavior.
- The mobile app must not contain secrets or direct AI provider keys.
- Paid access must be validated by a trusted backend or store entitlement provider.
- Backend-dependent features must fail gracefully when offline or unavailable.
- Local persistence should remain as an offline cache, not the only source of truth for server-backed data.

## P0 - Must Fix Before API-Backed MVP Start

1. **Create backend API foundation** ✅

   - Define and deploy the MVP backend base URL used by `VITE_API_BASE_URL`.
   - Set production/staging builds to `VITE_API_MODE=backend`.
   - Implement a typed HTTP contract matching existing frontend API clients in `src/shared/api`.
   - Add backend handling for:
     - auth/session;
     - current user/profile;
     - meetings sync;
     - tasks and agreements sync;
     - participants/workspace sync;
     - subscription status;
     - AI meeting summaries;
     - Google Calendar connection status and sync.
   - Add consistent backend error response shape so `src/shared/api/httpClient.ts` can show user-friendly errors.
   - Add API versioning or compatibility strategy before real users create data.

2. **Replace mock auth with real auth** ✅

   - Current affected areas:
     - `src/shared/api/authApi.ts`
     - `src/app/stores/auth.ts`
     - `src/pages/WelcomePage.vue`
     - `src/pages/SignInPage.vue`
     - `src/pages/SignUpPage.vue`
     - `src/pages/ForgotPasswordPage.vue`
     - `src/pages/AccountPage.vue`
   - Backend requirements:
     - `POST /auth/register`
     - `POST /auth/sign-in`
     - `POST /auth/refresh`
     - `POST /auth/sign-out`
     - `GET /auth/me`
     - password reset request and confirmation flow, or hide forgot-password until ready.
   - Mobile requirements:
     - Remove mock auth copy and `mock-access-token`.
     - Persist tokens securely enough for the chosen MVP standard. Prefer native secure storage plugin over localStorage for real tokens.
     - Handle expired access tokens, refresh failure, logout, and account deletion path if required by store policy.
     - Decide whether local-only mode still exists and how it migrates to an account later.

3. **Implement real subscription entitlement validation**

   - Current affected areas:
     - `src/features/subscription/services/subscriptionService.ts`
     - `src/features/subscription/services/mockSubscriptionProvider.ts`
     - `src/shared/api/subscriptionsApi.ts`
     - `src/app/stores/subscription.ts`
     - `src/pages/UpgradePage.vue`
   - Required integration:
     - Prefer RevenueCat or a direct Google Play Billing integration backed by server validation.
     - Validate Premium entitlements through a trusted source, not frontend state.
     - Implement backend endpoints or provider bridge for:
       - subscription status;
       - purchase validation;
       - restore purchases;
       - manage subscription link/deep link where supported.
   - Remove user-facing mock purchase flows:
     - "Start mock Premium";
     - fake renewal dates;
     - mock restore messages;
     - mock entitlement persistence.
   - Confirm Google Play subscription policy and Data Safety implications before selling Premium.

4. **Implement backend AI meeting summaries**

   - Current affected areas:
     - `src/features/meeting/aiSummaryService.ts`
     - `src/shared/api/aiApi.ts`
     - `src/pages/MeetingPage.vue`
     - `src/pages/MeetingSummaryPage.vue`
   - Backend contract already expected by frontend:
     - `POST /ai/meeting-summary`
     - request: `{ meeting, promptContract, locale }`
     - response: `{ summary, disclaimer, generatedAt }`
   - Required backend behavior:
     - AI provider key stored only on backend.
     - Premium entitlement checked server-side before generation.
     - Output must be short, neutral, practical, non-judgmental, and not therapy.
     - No private notes included unless explicitly designed and approved.
     - Rate limiting and abuse protection.
     - Logging strategy that avoids storing sensitive family text unnecessarily.
   - Mobile requirements:
     - Keep disclaimer: "AI summaries may be inaccurate. Review before relying on them."
     - Remove placeholder/mock wording from user-facing AI states.
     - Handle generation timeout/failure while still showing tasks and agreements.

5. **Implement cloud sync for core local data**

   - Current affected areas:
     - `src/shared/services/syncService.ts`
     - `src/shared/api/meetingsApi.ts`
     - `src/shared/api/tasksApi.ts`
     - participant sync in `syncService.ts`
     - Pinia stores under `src/app/stores`
   - Required backend endpoints:
     - `GET /meetings`
     - `POST /meetings/sync`
     - `POST /tasks/sync`
     - `GET /tasks`
     - `POST /participants/sync`
   - Required data model coverage:
     - meetings;
     - meeting sections;
     - notes;
     - tasks;
     - agreements;
     - participants;
     - workspace role/member basics;
     - settings that should roam, if any.
   - Required sync behavior:
     - Offline-first local writes remain usable.
     - Conflict handling is deterministic and user-safe.
     - Failed sync does not delete local data.
     - Server and client schema versions are tracked.
     - Migration path exists for current local-only users.
   - Decide whether private notes stay local-only. If they stay local-only, exclude them from sync and say so clearly.

6. **Implement workspace/member API basics**

   - Current affected areas:
     - `src/app/stores/workspace.ts`
     - `src/features/workspace/types.ts`
     - `src/features/workspace/permissions.ts`
     - `src/pages/WorkspaceSettingsPage.vue`
   - Required backend behavior:
     - Create/read/update household workspace.
     - Invite adult member/partner.
     - Role assignment for Owner and Adult member.
     - Viewer/Child profile only if still in MVP scope.
   - Avoid enterprise RBAC. Keep the existing simple roles unless product scope changes.

7. **Implement Google Calendar integration or remove it from MVP**

   - Current affected areas:
     - `src/pages/CalendarSyncPage.vue`
     - `src/features/calendar/services/calendarService.ts`
     - `src/shared/api/calendarApi.ts`
     - `src/app/stores/calendarSync.ts`
   - Required backend/API work if included:
     - Backend-supported Google OAuth flow.
     - Secure token storage on backend.
     - Calendar connection status endpoint.
     - Disconnect/revoke endpoint.
     - Sync endpoints for meeting reminders, task due dates, and follow-up dates.
   - Mobile app must not store Google access or refresh tokens.
   - If this cannot be completed safely, hide Calendar sync from MVP start.

8. **Replace placeholder legal, privacy, and store disclosures**

   - Update Privacy Policy and Terms for real backend behavior.
   - Cover:
     - account data;
     - synced meeting/task/agreement data;
     - local storage/offline cache;
     - AI summary processing;
     - subscription provider;
     - Google Calendar OAuth if included;
     - notifications;
     - export/share behavior;
     - data deletion/export rights.
   - Confirm Google Play Data Safety answers against actual backend, billing, AI, and Calendar behavior.

## P1 - Should Fix Before Wider API MVP Testing

9. **Secure token and sensitive data handling**

   - Do not store real auth tokens in plain localStorage for production.
   - Add a Capacitor secure-storage strategy or backend session approach appropriate for Android-first MVP.
   - Ensure logs do not expose meeting notes, private notes, tokens, subscription receipts, or AI prompts.
   - Add account deletion and logout cleanup behavior.

10. **Improve sync UX**

    - Add visible but quiet sync states:
      - saved locally;
      - syncing;
      - synced;
      - sync failed, retry.
    - Avoid noisy dashboards.
    - Add retry paths for failed backend operations.
    - Make offline behavior explicit without alarming users.

11. **Add API integration tests or contract checks**

    - Add focused tests for API DTO mapping and sync conflict handling.
    - Add backend contract examples for each endpoint.
    - Validate `VITE_API_MODE=backend` with missing/invalid `VITE_API_BASE_URL`.
    - Test backend unavailable, 401, 403, 409, 422, and 500 responses.

12. **Replace browser confirms with mobile dialogs**

    - Current `window.confirm` usage:
      - `src/pages/MeetingPage.vue`
      - `src/pages/PrivateNotesPage.vue`
      - `src/pages/TasksPage.vue`
    - Use app-native accessible dialogs/bottom sheets with Android back handling.

13. **Clean up all user-facing mock/debug UI**

    - Remove or dev-gate:
      - mock auth notices;
      - mock Premium controls;
      - mock workspace role switcher;
      - Premium feature checks panel;
      - Calendar placeholder text;
      - demo summary fallback on real routes.

## P2 - Production Readiness After API MVP Works

14. **Add observability and support**

    - Add privacy-conscious error reporting.
    - Add backend health checks for API, AI provider, subscription provider, and Calendar integration.
    - Add support diagnostics that do not expose sensitive family content.

15. **Complete release operations**

    - Configure Android signing.
    - Replace launcher and splash artwork.
    - Run real Android QA.
    - Prepare Play Console internal testing track.
    - Verify Data Safety, subscription setup, OAuth consent, and AI disclosures.

16. **Review performance and route splitting**

    - The build currently reports a large main chunk warning.
    - Consider lazy-loading settings, auth, history details, private notes, Calendar, and Upgrade routes.

## API Endpoints To Confirm Or Implement

Auth:

- `POST /auth/register`
- `POST /auth/sign-in`
- `POST /auth/refresh`
- `POST /auth/sign-out`
- `GET /auth/me`
- password reset endpoints if forgot password remains visible.

Meetings:

- `GET /meetings`
- `POST /meetings/sync`
- `POST /meetings/:id/summary` or keep summary save inside sync if preferred.

Tasks and agreements:

- `GET /tasks`
- `POST /tasks/sync`

Participants/workspace:

- `POST /participants/sync`
- workspace read/update endpoints.
- invite/member endpoints if multi-member MVP is included.

Subscriptions:

- `GET /subscriptions/status`
- `POST /subscriptions/validate`
- restore/manage integration depending on provider.

AI:

- `POST /ai/meeting-summary`

Calendar:

- `GET /calendar/google/status`
- `POST /calendar/google/connect`
- `POST /calendar/google/disconnect`
- `POST /calendar/google/meeting-reminder`
- `POST /calendar/google/task-due-date`
- `POST /calendar/google/follow-up-date`

## Mocked Or Debug Parts To Remove Or Gate

Remove from user-facing API-backed MVP:

- `mock-access-token` and mock auth sessions.
- `createMockSubscriptionProvider()` as active provider.
- `subscriptionMockState` as a real entitlement source.
- Mock Premium purchase/restore/manage UI.
- `settings.mockWorkspaceRole`.
- `settings.premiumFeatureChecks`.
- Calendar placeholder connection screen.
- Demo summary fallback data on real routes.
- Placeholder legal docs.
- Any visible "mock", "placeholder", "not connected yet", or "internal testing only" copy.

Can remain only for local development:

- Mock auth provider.
- Mock subscription provider.
- Local AI provider.
- Backend DTO stubs and API clients.
- Test fixtures and demo data behind dev-only flags.

## Suggested API MVP Start Order

1. Finalize backend data model and API contracts.
2. Implement real auth and secure mobile session storage.
3. Implement meetings/tasks/participants sync with migration from local-only data.
4. Implement subscription entitlement validation and remove mock purchase UI.
5. Implement backend AI summaries with server-side Premium enforcement.
6. Decide whether Calendar sync is in or out. If in, implement backend OAuth safely.
7. Replace legal/store disclosures and Android artwork.
8. Run full Android QA and backend failure-mode testing.
