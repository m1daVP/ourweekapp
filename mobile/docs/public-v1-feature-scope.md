# Public V1 Feature Scope

Audit date: 2026-06-15

This document locks the public v1 feature scope for OurWeek. Every visible
navigation area, store-listing claim, release note, and legal disclosure should
match this scope before public Android launch.

The local backend OpenAPI contract used for this scope review was available at:

```txt
http://localhost:3030/openapi.json
```

## Scope Rule

Public v1 includes all visible route areas currently exposed by the app:

- Home
- Meeting
- Tasks
- History
- Settings
- Templates
- Private Notes
- Calendar Sync
- Upgrade
- Workspace
- Account
- Support Diagnostics
- Auth
- Legal
- Logout

Do not describe these areas as hidden, test-only, draft, or coming later in
production-facing copy. If a feature is exposed in navigation or store copy, a
release reviewer must be able to open it and complete the related workflow.

## Feature Matrix

| Feature                                                                | Current app surface                                         | Backend or platform support                                                                                               | Production owner area | Launch status         | Later dependency                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------- | --------------------------------------------------------------------------- |
| Guided weekly meeting flow                                             | Home, Meeting, Meeting Summary, History                     | Local app data plus `/v1/meetings/`, `/v1/meetings/sync`, `/v1/meetings/{id}/summary`                                     | Meeting               | Included in public v1 | Sync hardening and multi-device QA in step 4                                |
| Participant setup                                                      | Settings participants and meeting participants              | `/v1/participants/sync`                                                                                                   | Participants, Meeting | Included in public v1 | Conflict and migration QA in step 4                                         |
| Notes, tasks, agreements, and responsibility assignment                | Meeting, Tasks, History details, Summary                    | `/v1/tasks/`, `/v1/tasks/sync`, meeting sync payloads                                                                     | Meeting, Tasks        | Included in public v1 | Sync and conflict behavior in step 4                                        |
| Meeting history                                                        | History, Meeting Details, Meeting Summary                   | Local history plus synced meeting records                                                                                 | History               | Included in public v1 | Free/Premium access verification in step 5                                  |
| Backend auth and secure session handling                               | Welcome, Sign Up, Sign In, Forgot Password, Logout, Account | `/v1/auth/register`, `/v1/auth/sign-in`, `/v1/auth/refresh`, `/v1/auth/sign-out`, `/v1/auth/me`, password reset endpoints | Auth, Account         | Included in public v1 | Full lifecycle QA in step 3                                                 |
| Backend sync for core data                                             | App startup, stores, support diagnostics                    | Meeting, participant, task, and workspace endpoints                                                                       | Sync, Storage         | Included in public v1 | Offline, migration, and conflict QA in step 4                               |
| Free and Premium access rules                                          | Upgrade, Premium locks, History limits, feature guards      | `/v1/subscriptions/status` and `/v1/billing/status` currently both exist                                                  | Access, Subscription  | Included in public v1 | Public contract reconciliation in step 2                                    |
| Real Premium purchase, restore, management, and entitlement validation | Upgrade, Account subscription actions                       | `/v1/subscriptions/validate`, `/restore`, `/manage` and matching `/v1/billing/*` endpoints                                | Subscription, Billing | Included in public v1 | Store billing provider and entitlement validation in step 5                 |
| Backend AI summaries                                                   | Meeting Details, Meeting Summary, Export                    | `/v1/ai/meeting-summary`                                                                                                  | AI, Meeting           | Included in public v1 | Backend enforcement, rate limits, and AI QA in step 6                       |
| Private notes with local-only behavior                                 | Private Notes, History shortcut                             | Device local app data only                                                                                                | Private Notes         | Included in public v1 | Confirm exclusion from sync, export, AI, and diagnostics in step 8          |
| Local reminders                                                        | Settings reminders, notification service                    | Capacitor Local Notifications                                                                                             | Reminders             | Included in public v1 | Real Android notification QA in step 9                                      |
| Export                                                                 | Meeting Details export, account export                      | Local meeting export, `/v1/exports/meeting`, `/v1/account/export`                                                         | Export, Account       | Included in public v1 | Choose production meeting export path in step 10                            |
| Google Calendar sync                                                   | Calendar Sync settings route                                | `/v1/calendar/google/*`                                                                                                   | Calendar              | Included in public v1 | Verify backend OAuth, disconnect, revoke, and disclosure behavior in step 7 |
| Account export and deletion                                            | Account settings                                            | `/v1/account/export`, `DELETE /v1/account/`                                                                               | Account               | Included in public v1 | Final retention and local cleanup policy in steps 3 and 13                  |
| Workspace/member basics                                                | Workspace settings                                          | `/v1/workspace/`, invitations, member update/remove endpoints                                                             | Workspace             | Included in public v1 | Role and permission QA in step 11                                           |

## Contract Decisions For Step 2

- The backend exposes both `/v1/subscriptions/*` and `/v1/billing/*`. Step 2
  must choose the public contract and document whether the other remains an
  alias.
- Meeting export can be generated locally and the backend exposes
  `/v1/exports/meeting`. Step 2 or step 10 must choose the production flow.
- `/health/ready` currently reports database readiness. Step 2 must confirm
  whether billing, AI, email, and Calendar providers should also be represented
  before launch.

## Production Copy Rules

- Production-facing copy must not say a visible feature is test-only, draft,
  hidden from release, or disabled until later.
- Production bundles must not include development-only mock providers or copy.
- Private notes must say: "Private notes are stored on this device unless a
  reviewed sync design is implemented."
- Premium access must be described as entitlement-backed; frontend state must
  not be presented as the production source of truth.
- AI summaries must be described as backend-generated and review-required.
- Google Calendar sync must use the verified backend OAuth implementation.
