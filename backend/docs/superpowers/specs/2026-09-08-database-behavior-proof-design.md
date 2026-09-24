# Database Behavior Proof Design

**Date:** 2026-09-08
**Status:** Implemented locally; staging verification blocked by target identity
**Readiness finding:** `docs/system-readiness-report-2026-09-07.md`, point 7

## Objective

Establish executable evidence for the database behavior relied on by public application flows. The proof must cover the complete migration chain, PostgreSQL transaction behavior, direct-role denial, workspace ownership boundaries, and account deletion in isolated local Supabase and a configured staging project.

## Environment Boundaries

Local Supabase is the repeatable destructive test environment. A local verification runner must resolve the CLI-provided URL and keys without printing them, require the API hostname to be `127.0.0.1` or `localhost`, reset the local database, apply the full migration chain, and run every guarded PostgreSQL integration test.

Staging is a non-reset smoke environment. Staging verification requires all of these explicit inputs:

- `SUPABASE_STAGING_URL`
- `SUPABASE_STAGING_ANON_KEY`
- `SUPABASE_STAGING_SERVICE_ROLE_KEY`
- `ALLOW_STAGING_DB_TESTS=true`

The staging runner must reject localhost, require an HTTPS Supabase URL, and refuse execution when the opt-in flag is absent. The configured URL and linked Supabase project must be reviewed before migrations are applied. Production credentials must not be supplied to this runner.

Staging fixtures use random UUIDs and `db-proof-` labels. Tests create only records they own and remove them in `finally` or suite cleanup. Staging is never reset, and tests must not update or delete records they did not create.

## Migration Proof

Local verification starts from an empty project database through `supabase db reset --local`. Success demonstrates that every versioned migration can apply in order to the current local Supabase/PostgreSQL version. After reset, the runner records the local migration version list and runs integration tests against the resulting schema.

Staging migration work follows this sequence:

1. inspect linked-project identity without printing credentials;
2. run the remote migration dry-run;
3. record pending migration versions;
4. review the pending SQL and recovery impact;
5. apply only the repository migration chain through Supabase CLI;
6. record the remote migration list after application;
7. run staging smoke tests;
8. preserve sanitized evidence.

No old migration is edited. A discovered schema defect is corrected by a new forward-only migration and tested locally before staging application.

## Shared Database Test Support

A focused helper under `tests/helpers` owns environment selection, client creation, URL guards, tagged identifiers, and safe cleanup primitives. It exposes service-role, anon, and authenticated clients without logging their keys or session tokens. Local PostgreSQL assertions that require catalog access or controlled failure injection live as pgTAP SQL tests under `supabase/tests` and run through `supabase test db`.

Local-only concurrency suites keep their current localhost guard. New proof suites use the shared helper and run in either local or staging mode. Staging tests require the explicit opt-in flag in addition to credentials. Missing credentials cause a visible skip during the ordinary unit suite; the dedicated verification runner treats a skip as failure.

To create an authenticated PostgREST role, the helper uses the service-role auth admin client to create a temporary Supabase Auth user, then signs in through the anon client. Cleanup deletes the temporary Auth user after application fixtures are removed.

## Direct Access Denial

The access-control suite maintains an explicit inventory of every application table exposed in `public`. Local pgTAP tests inspect table privileges and RLS state for `anon` and `authenticated`, then exercise representative statements under each role. The local and staging PostgREST clients each attempt:

- a bounded select;
- an insert with a harmless deliberately incomplete object;
- an update constrained to a fresh random UUID;
- a delete constrained to a fresh random UUID.

Every operation must return a permission error and no rows. This checks both RLS and grants; success with an empty result is a failure because it can conceal an overly broad grant behind a filter.

Representative service-role-only RPCs cover authentication, account deletion, membership mutation, invitation mutation, AI claiming/finalization, calendar/background work where exposed, and password reset. Anon and authenticated calls must fail for lack of execute permission. The tests use valid argument names and harmless random identifiers so a signature mismatch cannot be mistaken for authorization denial.

## Workspace Ownership Proof

The ownership suite creates two application users and two workspaces through the service-role client. Each workspace receives a member, participant, meeting, task, agreement, and invitation. Tests invoke real repositories and services with workspace A's authenticated context while passing resource identifiers from workspace B.

The suite proves that:

- workspace A lists contain no workspace B records;
- workspace A cannot load, update, soft-delete, or revise workspace B meetings;
- workspace A cannot load, update, soft-delete, or revise workspace B participants;
- workspace A cannot load, update, soft-delete, or revise workspace B tasks or agreements;
- workspace A cannot update or remove workspace B membership;
- workspace A cannot revoke, resend, or otherwise mutate workspace B invitations;
- failed cross-workspace attempts leave workspace B rows unchanged.

Tests assert safe not-found or forbidden application errors where services expose them and zero affected rows where repositories use conditional updates. They query the service-role client afterward to prove the target data remained unchanged.

## Account Deletion Proof

The account-deletion suite invokes the real `account_delete` RPC through `AccountRepository` or `AccountService` and covers three fixtures:

1. An ordinary member is removed from each active workspace, while workspace ownership and unrelated data remain unchanged.
2. An owner with another active owner/adult member transfers ownership deterministically to the eligible replacement, promotes that member to owner, and removes the deleting owner's membership.
3. A sole owner causes the owned workspace to be soft-deleted while its rows remain recoverable under that deleted workspace.

Every case verifies that the user is soft-deleted, all active sessions are revoked without replacing older revocation timestamps, and Google Calendar credentials are cleared with the connection disconnected. Calling deletion again must be safe and must preserve the first deletion/revocation timestamps.

A local-only pgTAP case installs a trigger inside the test transaction that raises when `account_delete` reaches the final user soft-delete after earlier session, calendar, and membership mutations. pgTAP catches the expected statement failure, then assertions verify that every earlier mutation rolled back. The surrounding test transaction removes the trigger and fixture automatically. Production migrations and functions receive no test-only branches. Staging runs the successful deletion cases without installing test-only database objects.

Cleanup uses the service role and removes only UUID-tagged fixtures. It accounts for foreign-key order and runs after failed assertions.

## Existing Transaction Suites

The dedicated local command runs all current database integration suites, including:

- AI claim concurrency and exact rate-limit boundaries;
- AI finalization idempotency and revision conflict;
- stale AI reservation recovery and workspace isolation;
- Google identity linking conflicts and rollback;
- atomic password-reset concurrency and rollback;
- pgTAP catalog, role-permission, account-deletion, and forced-rollback assertions;
- the new direct-access, ownership, and account-deletion suites.

The runner fails if a required suite is skipped. Ordinary `npm test` remains usable without database credentials and may skip guarded integration suites.

## Staging Scope

Staging proves that repository migrations apply to the linked non-production project and that the deployed database enforces the same direct-access, ownership, deletion, and representative transaction behavior. It does not run high-volume load tests or destructive database reset commands.

If staging already contains all migration versions, the migration step records that no versions are pending and proceeds to smoke tests. If the linked project cannot be positively identified as staging, work stops before any remote mutation.

## Evidence and Recovery

Sanitized evidence records:

- date and target label (`local` or `staging`);
- Supabase CLI and PostgreSQL versions where available;
- migration versions before and after;
- commands executed;
- test file and test counts;
- pass, fail, or blocked status;
- cleanup success;
- forward-fix or recovery notes.

Evidence excludes URLs containing credentials, API keys, JWTs, passwords, access/refresh tokens, fixture emails, and row contents. Local proof can be committed as documentation. Staging evidence is recorded only after cleanup succeeds or clearly documents residual fixture identifiers requiring manual removal.

For staging migration failure, stop dependent deployment, preserve CLI diagnostics with secrets redacted, and use a reviewed forward-fix migration. Do not edit an applied migration or reset staging.

## Acceptance Criteria

Point 7 is locally complete when:

- the full migration chain applies from an empty local database;
- every required database integration suite executes without skips and passes;
- anon and authenticated direct access is denied;
- cross-workspace reads and writes are rejected without target mutation;
- all three account-deletion cases and rollback behavior pass;
- cleanup succeeds;
- typecheck, ordinary tests, and build remain green.

Point 7 staging evidence is complete when:

- the linked target is positively identified as staging;
- migration dry-run and review complete;
- pending migrations apply or the remote is already current;
- guarded staging smoke tests pass without skips;
- tagged fixtures and temporary Auth users are removed;
- sanitized migration and test evidence is recorded.

Production migration and production data testing remain outside this work.

## Implementation Results

On 2026-09-09, npm run db:verify:local completed successfully against a hostname-guarded local Supabase instance. It rebuilt PostgreSQL 17 from all 33 migrations, passed 23 pgTAP assertions across two SQL files, and passed 82 required database integration tests across nine Vitest files without skips. That proof run passed 494 ordinary tests; the final CI run passed 495 after the staging metadata guard test was added. TypeScript checking, the production build, and OpenAPI verification passed. Fixture cleanup completed.

The proof exposed two database defects that static migration checks had not detected. Migration 20260909120000_harden_public_function_privileges.sql removes default client-role execution from existing and future public functions while retaining service-role access. Migration 20260909130000_fix_ai_rpc_column_ambiguity.sql gives the three AI claim functions and finalization function deterministic column resolution; all seven affected AI integration cases pass after the forward migration.

The staging preflight was attempted without mutation. The linked remote project is named OurWeek and the same target is referenced by production environment files, so it cannot be positively identified as staging. The runner rejected it before migration listing, dry-run, apply, or fixture creation. Staging acceptance remains open until a distinct project with staging metadata is linked and configured.
