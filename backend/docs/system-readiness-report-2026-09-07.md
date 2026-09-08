# OurWeek — readiness for real users

Assessment date: 7 September 2026. Scope: the current working copies of `weekly-us-api`, `weekly-us` (mobile), and `weekly-us-landing`, including existing uncommitted changes.

## Release decision

**Hold public launch. The product has a substantial implementation, but it is not ready for unrestricted real-user registration or a public paid release.**

The strongest parts are the domain-oriented backend, explicit authorization, secure native token storage, extensive regression tests, and thoughtful AI recovery behavior. The immediate problems are specific and fixable: unsafe account linking, private notes surviving account changes, broken participant actions, and a mobile build that misses application type errors. Operational and store validation also remain unproven in the evidence available here.

| Release stage | Assessment | Gate |
| --- | --- | --- |
| Internal testing with synthetic data | Suitable | Track the defects below; use isolated accounts and infrastructure |
| Small, invited household pilot | Conditional; not approved by this review | Fix findings 1–4; verify isolation, migrations, recovery, and the signed-device core journey |
| Public Free release | Hold | Complete pilot gates, public support/deletion verification, and release quality checks |
| Public paid Premium | Hold | Also complete real-store billing scenarios and validation of enabled AI/calendar integrations |
| iOS release | Unverified | Separate native signing, purchase, notification, secure-storage, and sharing QA |

These are engineering judgments based on repository evidence, not a percentage score. Passing unit tests cannot establish production uptime, store configuration, or absence of security defects.

## What was assessed

Reviewed application wiring, environment validation, authentication and account linking, password recovery, workspace authorization, representative repositories and migrations, meeting/task sync, local storage ownership, subscription enforcement and webhooks, AI release evidence, calendar security controls, account deletion/export, native configuration, landing pages, CI, and deployment documentation.

Checks used installed dependencies. No production account, database, payment, email, or provider operation was intentionally exercised. No runtime source code was changed. Existing user changes were preserved.

This was a source and local-check assessment, not a penetration test or a complete device/UI audit. Production dashboards, deployed migration state, backup restore history, alert delivery, store products, and signed artifacts were not verified. Attempts to retrieve the public policy/deletion pages through the web tool were unsuccessful; that is a verification limitation, not evidence that the site is down. Dependency vulnerability scanning and load testing were not performed.

## Findings that block launch

### 1. Google auto-linking can retain an attacker's access to a victim's account

**Priority: P1 — fix before public registration. Evidence: source-confirmed control flow; no live exploit attempted.**

Password registration creates a user and session without proving ownership of the email address. On first Google sign-in, the service searches for an existing user by the Google email and links the verified Google identity to that user. It does not require authentication to the existing account, distinguish an unverified password account, revoke its existing sessions, or remove its existing password credential.

Consequently, someone can register using another person's email before that person joins. If the real email owner later uses Google sign-in, both can retain access to the same account: the owner through Google and the original registrant through the existing password/session. Google's verified email establishes the Google user's ownership; it does not establish who originally created the password credential.

Evidence: [registration](D:/Projects/myself/weekly-us-api/src/modules/auth/auth.service.ts:611), [Google linking](D:/Projects/myself/weekly-us-api/src/modules/auth/auth.service.ts:844), and the test explicitly expecting email-based linking in [auth tests](D:/Projects/myself/weekly-us-api/tests/auth.service.test.ts:623).

**Required outcome:** prove email ownership before trusting password accounts; design explicit, authenticated linking/recovery for existing accounts. Regression-test pre-registration by a different person and ensure their credentials and sessions cannot survive the legitimate owner's recovery. Test both Google-first and password-first registration.

### 2. Private notes are not isolated between accounts on the same device

**Priority: P1 — privacy blocker for a real-user pilot. Evidence: source and passing regression test.**

Private notes use a single device-level storage slice without a user identifier. Switching users clears meetings, tasks, participants, and workspace state, but retains private notes in storage and in the Pinia store. The notes page displays that store without filtering by owner. An existing test explicitly expects a private note to survive a switch to a different account.

When the next account can access the Private Notes screen, it can see the previous person's notes. “Local-only” describes where data is stored; it does not provide isolation between signed-in people. This matters especially for a couples/family product used on a shared device.

Evidence: [owner change](D:/Projects/myself/weekly-us/src/shared/services/storageService.ts:1048), [session preparation](D:/Projects/myself/weekly-us/src/shared/services/syncSessionService.ts:16), [private-note store](D:/Projects/myself/weekly-us/src/app/stores/privateNotes.ts:49), [account-switch test](D:/Projects/myself/weekly-us/src/shared/services/__tests__/syncService.test.ts:627).

**Required outcome:** namespace notes and their backups by their owning account and reset the active in-memory view on session changes. Preserve existing notes through an explicit migration rather than silently deleting or assigning them to a new account. Verify A → logout → B → restart → A, including offline and Premium access changes.

### 3. Adding and re-enabling household participants calls a nonexistent method

**Priority: P1 — core onboarding/household-flow defect. Evidence: source and compiler diagnostics.**

The household settings component calls `meetingsStore.syncActiveMeetingParticipants()` after participant creation and re-enabling. The actual meeting store has no such action. These paths can mutate the participant locally and then throw, preventing the normal confirmation, invitation step, or sheet close.

The component test supplies a mock with this nonexistent method, so the test suite passes despite the broken integration.

Evidence: [create path](D:/Projects/myself/weekly-us/src/features/participants/components/HouseholdMembersSettings.vue:486), [enable path](D:/Projects/myself/weekly-us/src/features/participants/components/HouseholdMembersSettings.vue:568), [test mock](D:/Projects/myself/weekly-us/src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts:36).

**Required outcome:** align the component with the current meeting-attendance behavior and real store interface. Cover creation and re-enabling with the actual store, including during an active meeting; do not mechanically replace the call with an action requiring different semantics.

### 4. Password reset is now atomic; database verification remains open

**Priority: P1 — code remediated on 8 September 2026; isolated PostgreSQL and staging verification remain release gates.**

Reset confirmation now hashes the new password before one `confirm_password_reset` RPC call. The additive PostgreSQL function locks an eligible reset-token row, consumes it, changes the owning user's password, and revokes every active session in one transaction. Invalid, expired, consumed, and concurrent-loser tokens return the existing `422 invalid_reset_code`; database failures retain the safe `500 password_reset_failed` response.

The RPC uses `SECURITY DEFINER`, an empty `search_path`, fully qualified tables, and execute permission restricted to `service_role`. The previous direct table-write sequence and its partial `session_revoke_failed` branch were removed.

Evidence: [service call](D:/Projects/myself/weekly-us-api/src/modules/auth/auth.service.ts:1345), [atomic migration](D:/Projects/myself/weekly-us-api/supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql:1), [service tests](D:/Projects/myself/weekly-us-api/tests/password-reset.service.test.ts:306), [migration contract](D:/Projects/myself/weekly-us-api/tests/password-reset.migration.test.ts:8), and [guarded database tests](D:/Projects/myself/weekly-us-api/tests/password-reset.integration.test.ts:146).

Automated evidence on 8 September 2026: the focused password-reset command passed 13 tests and skipped the three isolated-database cases; `npm run ci` passed 469 tests with 12 guarded integration skips across the repository, plus typecheck and OpenAPI drift verification; `npm run build` passed. The password-reset integration cases were skipped because `SUPABASE_LOCAL_URL` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY` were unset. A direct local Supabase status check also found no running Docker engine.

**Remaining release outcome:** apply the additive migration to isolated local Supabase and pass the successful reset, two-request race, reuse, and forced-rollback cases. Then apply and verify the migration in staging before deploying the dependent backend. No staging or production migration was performed during this work.

## Quality and reliability gaps

### 5. The mobile build gives an incomplete quality signal

**Priority: P1 for release verification.**

`npm run build` passes, but its `vue-tsc --noEmit` invocation targets a solution configuration with an empty `files` list and project references. An explicit check of `tsconfig.app.json` fails. After suppressing only the TypeScript 6 deprecation diagnostic using the project's documented CLI flag, it reports application errors involving auth token shape, workspace null handling, localization, participant actions, export types, and storage initialization.

These are not all proven runtime failures, but finding 3 is a concrete example hidden by the current build. Formatting also fails in 16 files. Lint reports 3,555 errors and two warnings, largely because generated iOS web assets are included, with additional source/script issues.

Evidence: [build scripts](D:/Projects/myself/weekly-us/package.json:13), [solution config](D:/Projects/myself/weekly-us/tsconfig.json:1), [app config](D:/Projects/myself/weekly-us/tsconfig.app.json:1).

**Required outcome:** make the release check compile the actual app and Node configurations, fix substantive diagnostics, and exclude generated artifacts from source linting. Add a repeatable mobile CI gate; no `.github` workflow was found in this checkout. Keep meaningful behavior tests alongside mocks.

### 6. History, task synchronization, and account export lack complete pagination

**Priority: P2 — data completeness and growth risk.**

Meeting listing requests only the first 1,000 rows, with no continuation exposed by the mobile wrapper. Task/agreement lists and account export issue single queries without paging. The local Supabase configuration sets `max_rows = 1000`. At that configuration, larger households can receive incomplete results without a clear indication that more records exist. Account exports can therefore omit older records.

Evidence: [meeting service](D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.service.ts:467), [task query](D:/Projects/myself/weekly-us-api/src/modules/tasks/tasks.repository.ts:185), [export queries](D:/Projects/myself/weekly-us-api/src/modules/account/account.repository.ts:486), [Supabase limit](D:/Projects/myself/weekly-us-api/supabase/config.toml:18).

**Required outcome:** add bounded pagination or a complete cursor-based sync protocol and iterate exports through every page. Validate with more than 1,000 tasks/agreements and meetings, including deletes and concurrent edits. The remote row limit was not verified.

### 7. Database behavior has not been established by the checks run here

**Priority: P1 before enabling the affected production flows.**

There are real local-Supabase integration tests for AI claim concurrency, finalization, and stale-reservation recovery, but they are guarded by local credentials and were skipped. Other migration tests often verify SQL structure and expected guards rather than executing migrations. These are useful checks, but they cannot demonstrate transaction behavior, permissions, or compatibility in a running database.

**Required outcome:** apply the full migration chain to isolated Supabase, run integration tests, verify direct anonymous/authenticated access is denied, and exercise workspace ownership and account deletion. Test staging upgrades before deploying dependent code and preserve recovery evidence. Do not interpret skipped tests as passing integration coverage.

### 8. Production configuration and operational instructions have drifted

**Priority: P2; P1 if these artifacts are used for a fresh release.**

The Render blueprint omits `INVITATION_HANDOFF_URL`, required with production SMTP, and `AI_SAFETY_IDENTIFIER_SECRET`, required when explicitly selecting OpenAI. Deployment documentation describes a worker and commit-triggered deployment, while the actual blueprint parks the worker and disables automatic deploy triggers. CI instead calls a deploy hook after its checks. Manual dashboard configuration may compensate; it was not inspected.

The AI environment validator also checks the safety identifier secret only when the input explicitly says `AI_PROVIDER=openai`, while its transform can infer that provider from `AI_API_KEY`. Configuration validation should apply to the effective provider in both cases.

Evidence: [environment parser](D:/Projects/myself/weekly-us-api/src/config/env.ts:103), [blueprint](D:/Projects/myself/weekly-us-api/render.yaml:1), [deployment runbook](D:/Projects/myself/weekly-us-api/docs/deployment.md:1), [CI](D:/Projects/myself/weekly-us-api/.github/workflows/npm-ci.yml:1).

**Required outcome:** reconcile the blueprint, CI, actual processes, required variables, and migration/deployment order. Verify a candidate deployment using `/health/ready`, not only liveness. Record working alerts, an owner, and a restore rehearsal with recovery objectives. The repository has these intentions, but no verified operational completion evidence was available.

## Payments, integrations, privacy, and distribution

**Billing:** server-trusted entitlements, owner restrictions, a bounded 24-hour entitlement trust window, constant-time webhook-secret comparison, and re-fetching provider truth are positive controls. The real-device billing runbook has an empty evidence table. Purchase, restore, cancellation, renewal, expiration, refund, reinstall, outages, and non-owner attempts must be recorded before public paid access. Duplicate and out-of-order webhook delivery should also be exercised. See [billing validation](D:/Projects/myself/weekly-us/docs/production-billing-validation.md:1).

**AI:** implementation includes atomic-claim/finalization RPCs, stale recovery, private-content filtering, canonical commitment handling, and completion-before-generation sync. The checklist marks an evaluation and template staging runs complete, but says detailed evaluation evidence is stored outside the repository; final staging/all-locale sign-off and manual scenarios remain unchecked. I did not independently validate the funded results. Require those records and the skipped database tests before approving AI for users. See [AI release checklist](D:/Projects/myself/weekly-us-api/AI_RELEASE_CHECKLIST.md:207).

**Calendar and invitations:** signed expiring OAuth state, redirect restrictions, and encrypted provider tokens are implemented. Native callback, revoke/reconnect, daylight-saving/time-zone behavior, and invitation handoff still need device evidence. Android currently registers a custom `weeklyus` scheme; verified HTTPS App Links were not present in the inspected manifest. Assess competing-app link handling before relying on custom-scheme delivery for sensitive invitations.

**Logs:** sensitive field redaction exists, but it does not sanitize query strings inside URLs. The error handler explicitly attaches `request.url` to Sentry, and calendar callbacks use query parameters. Inspect emitted request logs and telemetry with synthetic callback codes/state, and sanitize URLs before capture. No production token disclosure was demonstrated. See [error capture](D:/Projects/myself/weekly-us-api/src/shared/errors/error-handler.ts:82) and [redaction](D:/Projects/myself/weekly-us-api/src/shared/logging/pino-options.ts:1).

**Policies and deletion:** mobile policy content and landing `/privacy`, `/terms`, and `/delete-account` pages exist. The landing build renders them. The deletion page offers an unauthenticated email request route; in-app deletion and local cleanup are implemented. Some roadmap checkboxes still say the landing pages are missing, so they are stale. Legal review, deployed page availability, support-mailbox handling, store disclosure submission, and the documented retention/backup periods need confirmation against actual operations. This report makes no legal-compliance determination.

**Landing page:** it remains an early-access funnel: “Start free” and Premium CTAs lead to the waitlist. Invitation fallback tells users to install but provides no direct store link. The shared layout loads Tally's script on every page, including invitation pages containing a token in the URL. Minimize third-party script execution on that handoff page and verify actual data flows. Update acquisition/install paths when the app becomes publicly available.

**Android/iOS:** Android backup is explicitly disabled, which helps protect local plaintext app data. Native secure storage is used for auth tokens, but private notes themselves remain ordinary local storage. Android metadata is still `versionCode 1`, `versionName 0.3.0`, while the mobile package is `0.6.0`; synchronize release identification. A signed AAB, installed internal-track build, keystore recovery, and iOS release were not tested. See [Android build](D:/Projects/myself/weekly-us/android/app/build.gradle:10).

**Performance and usability:** the web build succeeds with an approximately 879 kB minified main JavaScript chunk (261 kB gzip) and a 928 kB welcome image. These warrant measurement on a low-end phone rather than assuming good startup performance. Screen-reader behavior, touch targets, keyboard handling, narrow screens, offline interactions, and supported locales require device QA; unit coverage alone does not settle them.

## Verification results

| Check | Observed result |
| --- | --- |
| API `npm run typecheck` | Passed |
| API `npm run build` | Passed |
| API `npm run openapi:check` | Passed |
| API initial full test run | 59 files passed, 2 failed in setup, 3 skipped; 454 tests passed, 12 skipped |
| API isolated retry of failed files | Both passed, all 5 tests passed; original failures were 15-second setup timeouts, plus cleanup after failed setup |
| API full rerun without competing checks | Passed: 61 files, 459 tests; 3 database integration files / 7 tests skipped. Initial timeout failures were not reproduced |
| Mobile `npm test` | 71 files, 566 tests passed; warnings included duplicate plugin registration and missing test props |
| Mobile `npm run build` | Passed; does not establish a clean app typecheck |
| Mobile explicit app typecheck | Failed on TypeScript 6 `baseUrl` deprecation |
| Mobile explicit app typecheck with `--ignoreDeprecations 6.0` | Failed with substantive application diagnostics, including nonexistent participant action |
| Mobile `npm run check` | Failed formatting in 16 files; chained lint did not run |
| Mobile separate `npm run lint` | Failed: 3,555 errors, 2 warnings; largely generated iOS assets, plus source/script issues |
| Landing `npm run build` | Passed; generated all five pages |
| Database integration, paid provider calls, physical devices, signed release | Not exercised |

The release-mode mobile build was not run because its Sentry plugin can upload source maps using configured credentials. The ordinary build above is local build evidence, not proof of the release configuration or signed package.

## Recommended completion order

1. **Close the privacy/authentication defects:** findings 1, 2, and 4. Acceptance evidence must include concurrent reset behavior and two-account isolation, not just happy paths.
2. **Repair the household flow and quality gate:** finding 3, explicit mobile TypeScript checks, useful lint scope, and green release CI. Add integration tests that cannot invent nonexistent store actions.
3. **Prove data reliability:** isolated migrations/RLS tests, two-device create/edit/delete/conflict tests, offline/restart recovery, account export completeness, and owner/member deletion behavior.
4. **Build and test the actual release:** signed Android internal-track install; email recovery and invitations; notification deny/allow/reboot; export/share; supported locales and accessibility. Record app/native/API revisions together.
5. **Verify production operations and disclosures:** deployed policies/deletion route, support process, provider settings, alert delivery, backup restore, migration ordering, and rollback/forward-fix procedure.
6. **Open a small invited pilot:** use a defined household cohort, responsive support, and explicit stop conditions for privacy incidents, lost edits, broken login, or incorrect charges. Enable integrations only as their gates pass.
7. **Enable public paid access after billing evidence is complete:** retain a release decision with named owner, date, revisions, test records, and accepted limitations.

Avoid estimating launch time from feature count. The remaining work combines a handful of concrete code defects with external verification; completion should be judged by the acceptance evidence above.

