# Database Behavior Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish repeatable local and staging evidence that the complete migration chain, database permissions, workspace ownership boundaries, transaction RPCs, and account deletion behave safely for real users.

**Architecture:** A shared Vitest helper selects an explicitly guarded local or staging Supabase target and owns tagged fixtures, authenticated clients, cleanup, and required-suite signaling. Vitest integration suites prove behavior through PostgREST and the application's real repositories/services, while pgTAP proves catalog grants and forced transaction rollback locally. TypeScript runners orchestrate local reset/migrations/tests and staging identity review/migration smoke checks without printing credentials.

**Tech Stack:** Node.js 24, TypeScript 7, Vitest 4, Supabase CLI 2.116, `@supabase/supabase-js` 2.112, PostgreSQL 17, pgTAP.

## Global Constraints

- Never use production credentials or run a database reset outside a URL whose hostname is exactly `127.0.0.1` or `localhost`.
- Staging requires `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, and `ALLOW_STAGING_DB_TESTS=true`.
- The staging URL must use HTTPS, must not be local, and its project reference must match `supabase/.temp/project-ref` before any remote mutation.
- Staging is never reset; staging tests may update or delete only random UUID fixtures bearing a `db-proof-` label.
- Do not edit an applied migration. Correct schema defects with a new forward-only migration after local verification.
- Ordinary `npm test` must remain usable without database credentials; guarded suites visibly skip in that mode.
- Dedicated local and staging verification commands must fail when a required suite skips.
- Never log or persist API keys, JWTs, passwords, access/refresh tokens, fixture emails, credential-bearing URLs, or database row contents.
- Use the service-role client only in server-side test support and runners.
- Preserve unrelated untracked files `AI_PROMPTS.js` and `AI_PROMPTS_PLAN.md`.
- Do not stage or commit any task until the user approves an exact numbered commit proposal.

## File Structure

| File | Responsibility |
| --- | --- |
| `tests/helpers/database-test-environment.ts` | Parse and guard local/staging configuration, create Supabase clients, create temporary Auth users, and expose required-suite mode. |
| `tests/helpers/database-proof-fixtures.ts` | Create UUID-tagged application fixtures and remove them in foreign-key-safe order. |
| `tests/database-test-environment.test.ts` | Unit-test environment guards without network access. |
| Existing `tests/*.integration.test.ts` files | Consume the common local guard/client instead of duplicating credential parsing. |
| `tests/database-direct-access.integration.test.ts` | Prove anon/authenticated table and RPC denial through PostgREST. |
| `supabase/tests/database_security.test.sql` | Prove catalog RLS, grants, and representative role statements with pgTAP. |
| `tests/database-workspace-ownership.integration.test.ts` | Prove repository/service workspace scoping and mutation safety. |
| `tests/account-deletion.integration.test.ts` | Prove member, replacement-owner, sole-owner, and idempotent deletion behavior. |
| `supabase/tests/account_delete_rollback.test.sql` | Inject a local transaction failure and prove all preceding account deletion mutations roll back. |
| `scripts/database-proof-process.ts` | Run child commands with inherited output, sanitized evidence summaries, and skip enforcement. |
| `scripts/verify-local-database.ts` | Resolve local CLI credentials, guard localhost, reset, list migrations, run pgTAP/Vitest/typecheck/build, and write local evidence. |
| `scripts/verify-staging-database.ts` | Validate explicit staging opt-in and linked identity, dry-run/apply migrations, run smoke suites, and write staging evidence. |
| `package.json` | Expose `db:verify:local` and `db:verify:staging`. |
| `docs/database-proof/README.md` | Operator steps, safety boundaries, cleanup handling, and recovery procedure. |
| `docs/database-proof/*.md` | Sanitized generated evidence for an observed verification run. |
| `docs/system-readiness-report-2026-09-07.md` | Record point 7 evidence only after the corresponding commands pass. |

---

### Task 1: Shared Database Test Environment

**Files:**
- Create: `tests/helpers/database-test-environment.ts`
- Create: `tests/database-test-environment.test.ts`
- Modify: `tests/ai-summary-generation-claim.integration.test.ts`
- Modify: `tests/ai-summary-generation-finalization.integration.test.ts`
- Modify: `tests/ai-stale-reservation-recovery.integration.test.ts`
- Modify: `tests/google-auth-linking.integration.test.ts`
- Modify: `tests/password-reset.integration.test.ts`

**Interfaces:**
- Produces: `resolveDatabaseTestEnvironment(source?: NodeJS.ProcessEnv): DatabaseTestEnvironment | null`.
- Produces: `describeDatabase`, which is `describe` only for a valid configured target and `describe.skip` otherwise.
- Produces: `createServiceRoleClient(environment)`, `createAnonClient(environment)`, and `createAuthenticatedTestUser(environment, label)`.
- Produces: `requireDatabaseSuccess(error, operation)` and `databaseFixtureLabel(kind, id)`.
- `DatabaseTestEnvironment` is `{ target: 'local' | 'staging'; url: string; anonKey: string; serviceRoleKey: string; required: boolean }`.
- `createAuthenticatedTestUser` returns `{ authUserId: string; client: SupabaseClient; cleanup(): Promise<void> }` and never exposes tokens.

- [ ] **Step 1: Write guard unit tests that fail before the helper exists**

Create table-driven tests covering: no configuration returns `null`; localhost local configuration is accepted; non-local local URL is rejected; staging without `ALLOW_STAGING_DB_TESTS=true` returns `null`; staging HTTP/local URLs throw; complete HTTPS staging configuration is accepted; `DATABASE_PROOF_REQUIRED=true` sets `required: true`.

```ts
expect(resolveDatabaseTestEnvironment({
  SUPABASE_LOCAL_URL: 'http://127.0.0.1:54321',
  SUPABASE_LOCAL_ANON_KEY: 'anon',
  SUPABASE_LOCAL_SERVICE_ROLE_KEY: 'service',
} as NodeJS.ProcessEnv)).toMatchObject({ target: 'local', required: false });

expect(() => resolveDatabaseTestEnvironment({
  SUPABASE_STAGING_URL: 'http://example.supabase.co',
  SUPABASE_STAGING_ANON_KEY: 'anon',
  SUPABASE_STAGING_SERVICE_ROLE_KEY: 'service',
  ALLOW_STAGING_DB_TESTS: 'true',
} as NodeJS.ProcessEnv)).toThrow('Staging database proof requires HTTPS.');
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- tests/database-test-environment.test.ts`

Expected: FAIL because `tests/helpers/database-test-environment.ts` does not exist.

- [ ] **Step 3: Implement strict target selection and client factories**

Use `new URL(value)` for validation. Give local variables precedence only when all three local values exist. Treat partially configured local or staging groups as a configuration error. Configure every client with `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }`.

```ts
export type DatabaseTestEnvironment = {
  target: 'local' | 'staging';
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  required: boolean;
};

export function databaseFixtureLabel(kind: string, id = randomUUID()) {
  return `db-proof-${kind}-${id}`;
}

export const databaseEnvironment = resolveDatabaseTestEnvironment();
export const describeDatabase = databaseEnvironment ? describe : describe.skip;
```

For temporary Auth users, concatenate the `db-proof-` prefix, a new UUID, and the `@example.invalid` suffix. Call `service.auth.admin.createUser({ email, password, email_confirm: true })`, then call `anon.auth.signInWithPassword`. Throw sanitized operation errors and return a cleanup function that calls `auth.admin.deleteUser(authUserId)`.

- [ ] **Step 4: Make required mode fail instead of silently skipping**

At module initialization, throw `Database proof credentials are required for this command.` when `DATABASE_PROOF_REQUIRED=true` but no complete valid target exists. This makes dedicated runners fail before Vitest can report a skip.

- [ ] **Step 5: Replace duplicated guards in all five existing integration files**

Import the common environment and service client. Keep each suite local-only by selecting `describe` only when `databaseEnvironment?.target === 'local'`; staging scope for these concurrency suites remains controlled by the later staging runner.

```ts
const describeLocalDatabase = databaseEnvironment?.target === 'local'
  ? describe
  : describe.skip;

function client() {
  return createServiceRoleClient(databaseEnvironment!);
}
```

- [ ] **Step 6: Verify default and configured behavior**

Run: `npm test -- tests/database-test-environment.test.ts tests/google-auth-linking.integration.test.ts tests/password-reset.integration.test.ts`

Expected without DB variables: guard unit tests PASS and the two integration suites SKIP visibly. Expected with guarded local variables: all tests PASS.

- [ ] **Step 7: Prepare a review boundary**

Inspect only the files in this task with `git diff --check` and `git diff -- tests/helpers/database-test-environment.ts tests/database-test-environment.test.ts tests/ai-summary-generation-claim.integration.test.ts tests/ai-summary-generation-finalization.integration.test.ts tests/ai-stale-reservation-recovery.integration.test.ts tests/google-auth-linking.integration.test.ts tests/password-reset.integration.test.ts`. If a commit is later approved, propose `test(database): centralize guarded integration setup` with the exact file list; do not stage or commit now.

---

### Task 2: Tagged Fixture Builder and Safe Cleanup

**Files:**
- Create: `tests/helpers/database-proof-fixtures.ts`
- Create: `tests/database-proof-fixtures.integration.test.ts`

**Interfaces:**
- Consumes: `DatabaseTestEnvironment`, `createServiceRoleClient`, `databaseFixtureLabel`, and `requireDatabaseSuccess` from Task 1.
- Produces: `createDatabaseProofFixture(environment, options?: DatabaseProofFixtureOptions): Promise<DatabaseProofFixture>`.
- Produces: `cleanupDatabaseProofFixture(environment, fixture): Promise<void>`.
- `DatabaseProofFixture` contains `runId`, two users, two workspaces, memberships, participants, meetings, tasks, agreements, invitations, session IDs, and calendar connection IDs.
- `DatabaseProofFixtureOptions` is `{ workspaceAReplacementOwner?: boolean; failAfter?: 'workspaceA'; onProgress?: (fixture: DatabaseProofFixture) => void }`.

- [ ] **Step 1: Write the fixture lifecycle integration test**

The test creates a fixture, asserts both workspaces and representative child rows exist, calls cleanup twice, then verifies both tagged user IDs and workspace IDs no longer exist. Track the fixture before any insert so `afterEach` can clean partial setup.

```ts
fixture = await createDatabaseProofFixture(databaseEnvironment!, {
  workspaceAReplacementOwner: true,
});
expect(fixture.workspaceA.id).not.toBe(fixture.workspaceB.id);
await cleanupDatabaseProofFixture(databaseEnvironment!, fixture);
await cleanupDatabaseProofFixture(databaseEnvironment!, fixture);
```

- [ ] **Step 2: Run and confirm the missing-helper failure**

Run: `npm test -- tests/database-proof-fixtures.integration.test.ts`

Expected: FAIL because `createDatabaseProofFixture` is undefined.

- [ ] **Step 3: Implement deterministic, UUID-tagged fixture creation**

Insert users before workspaces; workspaces before memberships/participants/meetings; meetings before tasks/agreements; and participants before participant-linked invitations. Use only UUID primary keys created in Node and names beginning `db-proof-`. Populate current schema fields including `check_in_completed`, `avatar_type`, `responsible_user_ids`, invitation delivery fields, sessions, and encrypted-looking calendar token strings that are synthetic and never logged.

- [ ] **Step 4: Implement idempotent foreign-key-safe cleanup**

Delete only rows constrained by recorded UUIDs, in this order: task review decisions, agreements, tasks, AI/assistant/calendar child rows, invitations, meetings, participants, memberships, subscriptions, sessions, auth identities/password reset tokens, workspaces, application users, then temporary Supabase Auth users. Treat zero deleted rows as success; collect sanitized table/operation failures and throw one cleanup error at the end.

- [ ] **Step 5: Prove cleanup after both success and a partial fixture failure**

Add a test-only `failAfter: 'workspaceA'` option. Assert the helper throws after creating workspace A, then call cleanup with the returned tracked fixture state through an `onProgress` callback. Verify no tagged rows remain. The option exists only in test helper code and never in migrations or production services.

- [ ] **Step 6: Run the lifecycle suite against local Supabase**

Run with Task 1 local variables: `npm test -- tests/database-proof-fixtures.integration.test.ts --reporter=verbose`

Expected: lifecycle, idempotent cleanup, and partial-failure cleanup tests PASS with no skips.

- [ ] **Step 7: Prepare a review boundary**

Run `git diff --check`. If later approved, propose `test(database): add isolated proof fixtures` for only the two task files.

---

### Task 3: Direct Table and RPC Access Denial

**Files:**
- Create: `tests/database-direct-access.integration.test.ts`
- Create: `supabase/tests/database_security.test.sql`

**Interfaces:**
- Consumes: environment/client/Auth-user helpers from Task 1.
- Produces: `PUBLIC_APPLICATION_TABLES`, the explicit application-table inventory used by PostgREST tests.
- Produces: `SERVICE_ROLE_ONLY_RPCS`, pairs of RPC name and valid harmless arguments.

- [ ] **Step 1: Write PostgREST denial tests for the full public table inventory**

Declare exactly these tables: `users`, `sessions`, `workspaces`, `workspace_members`, `workspace_invitations`, `participants`, `meetings`, `tasks`, `agreements`, `task_review_decisions`, `subscriptions`, `calendar_connections`, `calendar_events`, `ai_summary_requests`, `auth_identities`, `password_reset_tokens`, `assistant_settings`, `assistant_recap_credit_reservations`, `assistant_follow_ups`, and `calendar_preferences`.

For both anon and a real temporary authenticated client, run bounded select, insert `{ id: randomUUID() }`, update by a fresh UUID, and delete by a fresh UUID. Assert each result has an authorization error (`42501`, `permission denied`, or the corresponding PostgREST permission code) and has no returned rows. A successful empty result must fail.

- [ ] **Step 2: Write representative RPC denial tests with valid signatures**

Cover these groups with harmless random IDs and the exact argument maps below. Assert anon and authenticated clients fail specifically for execute permission, not missing function/signature errors.

```ts
const id = randomUUID();
const rpcCases = [
  ['account_delete', { p_user_id: id, p_deleted_at: new Date().toISOString() }],
  ['workspace_update_active_member', { p_workspace_id: id, p_user_id: id, p_role: null, p_status: null }],
  ['create_participant_invitation', { p_workspace_id: id, p_participant_id: id, p_email: 'db-proof-denied@example.invalid', p_email_normalized: 'db-proof-denied@example.invalid', p_role: 'viewer', p_token_hash: 'db-proof-denied', p_expires_at: new Date().toISOString() }],
  ['revoke_participant_invitation', { p_workspace_id: id, p_invitation_id: id }],
  ['claim_ai_summary_generation_v3', { p_workspace_id: id, p_meeting_id: id, p_user_id: id, p_provider: 'openai', p_input_hash: 'db-proof-denied', p_effective_model: 'db-proof-model', p_prompt_version: 'db-proof-v1', p_user_limit: 1, p_workspace_limit: 1, p_window_seconds: 60 }],
  ['finalize_ai_summary_generation', { p_workspace_id: id, p_request_id: id, p_meeting_id: id, p_expected_server_revision: 1, p_generated_summary: {}, p_completed_at: new Date().toISOString(), p_input_tokens: 0, p_output_tokens: 0, p_total_tokens: 0 }],
  ['reconcile_abandoned_assistant_recap_requests', { p_workspace_id: id }],
  ['enqueue_background_job', { p_job: { type: 'db-proof-denied' }, p_delay_seconds: 0 }],
  ['reserve_assistant_recap_credit', { p_workspace_id: id, p_ai_summary_request_id: id, p_allowance_period_ends_at: new Date().toISOString(), p_limit: 1 }],
  ['confirm_password_reset', { p_code_hash: 'db-proof-denied', p_password_hash: 'db-proof-denied', p_confirmed_at: new Date().toISOString() }],
  ['link_google_auth_identity', { p_user_id: id, p_provider_subject: 'db-proof-denied', p_email: 'db-proof-denied@example.invalid', p_display_name: null, p_avatar_url: null }],
] as const;
```

- [ ] **Step 3: Run the PostgREST suite and observe any real grant gaps**

Run with local credentials: `npm test -- tests/database-direct-access.integration.test.ts --reporter=verbose`

Expected before any required forward fix: every case executes; any success or signature error is a concrete failing test to resolve.

- [ ] **Step 4: Add pgTAP catalog assertions**

In `supabase/tests/database_security.test.sql`, start a transaction, call `no_plan()`, and query `pg_class`, `pg_namespace`, `pg_roles`, `information_schema.role_table_grants`, and `pg_proc`. Assert all 20 application tables have RLS enabled, neither `anon` nor `authenticated` has table DML privileges, and representative RPCs lack execute privilege for both roles while `service_role` has execute.

```sql
begin;
select no_plan();
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = any(array['users','sessions']) and c.relrowsecurity),
  2,
  'listed public application tables enable RLS'
);
select * from finish();
rollback;
```

- [ ] **Step 5: Add role-level representative statements inside pgTAP**

Use `set local role anon` and `set local role authenticated` inside exception-catching helper blocks to assert a bounded `SELECT`, `INSERT`, `UPDATE`, and `DELETE` raises SQLSTATE `42501`. Restore the test role after each block. Do not insert persistent rows.

- [ ] **Step 6: Run both access layers**

Run: `npx supabase test db supabase/tests/database_security.test.sql`

Run: `npm test -- tests/database-direct-access.integration.test.ts --reporter=verbose`

Expected: pgTAP and all PostgREST cases PASS. If a schema defect is found, add a new timestamped migration that only corrects the missing RLS/revoke/grant rule, then reset local Supabase and rerun both commands; never edit `20260710213817_enable_rls_deny_all.sql`.

- [ ] **Step 7: Prepare a review boundary**

Run `git diff --check`. If later approved, propose `test(database): prove direct role access is denied`, including a forward-only permission migration only if the tests demonstrated it was necessary.

---

### Task 4: Workspace Ownership Boundaries

**Files:**
- Create: `tests/database-workspace-ownership.integration.test.ts`

**Interfaces:**
- Consumes: `DatabaseProofFixture` and cleanup from Task 2.
- Consumes real `MeetingsRepository`, `ParticipantsRepository`, `TasksRepository`, `WorkspacesRepository`, `createDefaultMeetingsService`, `listParticipantsWithSupabase`, `createDefaultTasksService`, and `WorkspaceService`.
- Produces: an integration matrix showing workspace A context cannot observe or mutate workspace B rows.

- [ ] **Step 1: Seed two complete workspaces and construct workspace A auth context**

Use `{ userId: fixture.userA.id, sessionId: fixture.userA.sessionId, workspaceId: fixture.workspaceA.id, role: 'owner', planType: 'premium' }`. Instantiate repositories with the service-role client, because backend authorization relies on explicit workspace filters when service role bypasses RLS.

- [ ] **Step 2: Write list and lookup isolation tests**

Call `createDefaultMeetingsService(serviceClient).listMeetings(auth)`, `listParticipantsWithSupabase(serviceClient, { workspaceId: auth.workspaceId })`, and `createDefaultTasksService(serviceClient).listTasks(auth)`; assert every response excludes workspace B IDs. Call `findMeetingByIdForWorkspace`, `findParticipantByIdForWorkspace`, `findTaskByIdForWorkspace`, and `findAgreementByIdForWorkspace` with workspace A ID plus the B resource ID; expect `null`.

- [ ] **Step 3: Write revision update and soft-delete isolation tests**

Call each repository's conditional update and soft-delete method with workspace A ID, workspace B resource ID, and B's current revision. Expect `null`. Re-read B through the service-role client and assert its title/name, `server_revision`, and `deleted_at` are unchanged.

```ts
const result = await meetings.updateMeeting(
  fixture.workspaceA.id,
  fixture.workspaceB.meetingId,
  1,
  fixture.workspaceB.meetingUpdate,
);
expect(result).toBeNull();
await expectRowUnchanged('meetings', fixture.workspaceB.meetingId, before);
```

- [ ] **Step 4: Write membership mutation isolation tests through `WorkspaceService`**

Call `updateMember` and `removeMember` with workspace A auth and workspace B's member user ID. Expect `ApiError` code `workspace_member_not_found`. Re-read the B membership and assert role/status/timestamps are unchanged.

- [ ] **Step 5: Write invitation mutation isolation tests**

Call `revokeInvitation` and `resendInvitation` with workspace A auth and workspace B invitation ID. Inject a mailer stub and invitation URL builder so no external email is sent. Expect `workspace_invitation_not_found`; assert B invitation status, token hash, delivery fields, and expiry are unchanged.

- [ ] **Step 6: Run the ownership suite**

Run with local configuration: `npm test -- tests/database-workspace-ownership.integration.test.ts --reporter=verbose`

Expected: all list, lookup, update, delete, membership, and invitation cases PASS; cleanup reports no residual tagged records.

- [ ] **Step 7: Prepare a review boundary**

Run `git diff --check`. If later approved, propose `test(database): prove workspace ownership boundaries` for this test only, plus a focused repository/service fix only if the new proof exposed a real scoping defect.

---

### Task 5: Account Deletion Success, Idempotency, and Rollback

**Files:**
- Create: `tests/account-deletion.integration.test.ts`
- Create: `supabase/tests/account_delete_rollback.test.sql`

**Interfaces:**
- Consumes: Task 1 environment/client support and Task 2 fixture/cleanup.
- Consumes: `new AccountRepository(serviceClient).deleteAccountAtomically(userId, deletedAt)`.
- Produces: three successful deletion scenarios plus one forced rollback proof.

- [ ] **Step 1: Write the ordinary-member deletion case**

Seed a deleting member in two active workspaces, active and previously revoked sessions, and connected Google Calendar rows with synthetic access/refresh tokens. Invoke `deleteAccountAtomically`. Assert user `deleted_at` equals the requested instant; active memberships become removed; workspace owner IDs and unrelated rows stay unchanged; active sessions receive revocation timestamps; the previously revoked timestamp compares equal as an instant; calendar tokens and OAuth state fields are null and state is `disconnected`.

- [ ] **Step 2: Write the replacement-owner case**

Seed the deleting user as owner and another eligible active `adult_member`, with deterministic `created_at` ordering. Invoke deletion and assert the eligible member becomes `owner`, `workspaces.owner_id` becomes that user ID, and the deleting user's membership becomes `removed`.

- [ ] **Step 3: Write the sole-owner case**

Seed a workspace with no eligible replacement. Assert deletion sets `workspaces.deleted_at` while retaining the workspace and all child rows for recovery, and removes the deleting owner's active membership.

- [ ] **Step 4: Prove idempotency for every case**

Call `deleteAccountAtomically` again with a later timestamp. Assert the original user deletion timestamp, original session revocation timestamps, transferred ownership, removed memberships, and workspace deletion timestamp do not change.

- [ ] **Step 5: Add local pgTAP failure injection**

Inside a pgTAP transaction, seed a user, membership, sessions, and calendar connection. Create a temporary trigger function and trigger that raises SQLSTATE `P0001` immediately before the final `users.deleted_at` update. Call `public.account_delete` inside a nested exception block and assert the expected error. Then assert sessions, calendar credentials, membership, workspace ownership/deletion, and user deletion all retain their pre-call values.

```sql
create function pg_temp.fail_account_delete_user_update() returns trigger
language plpgsql as $$ begin raise exception 'db_proof_forced_failure'; end $$;

create trigger db_proof_fail_account_delete
before update of deleted_at on public.users
for each row when (old.id = '00000000-0000-4000-8000-000000000701'::uuid)
execute function pg_temp.fail_account_delete_user_update();
```

Use generated fixed test UUID literals that cannot collide with application data. End with `rollback` so the trigger and fixture disappear. Do not add any production migration branch.

- [ ] **Step 6: Run success and rollback suites**

Run: `npm test -- tests/account-deletion.integration.test.ts --reporter=verbose`

Run: `npx supabase test db supabase/tests/account_delete_rollback.test.sql`

Expected: all three success/idempotency scenarios and forced rollback assertions PASS.

- [ ] **Step 7: Prepare a review boundary**

Run `git diff --check`. If later approved, propose `test(account): prove deletion transaction behavior` for the two task files, plus a forward-only migration only if a demonstrated database defect requires it.

---

### Task 6: Local Verification Runner

**Files:**
- Create: `scripts/database-proof-process.ts`
- Create: `scripts/verify-local-database.ts`
- Create: `tests/database-proof-process.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `runCommand(command: string, args: readonly string[], options: { env?: NodeJS.ProcessEnv; capture?: boolean; label: string }): CommandEvidence`, which never accepts secrets in argv and inherits or captures sanitized child output.
- `CommandEvidence` is `{ label: string; startedAt: string; finishedAt: string; exitCode: number; status: 'passed' | 'failed'; output?: string }`; `output` exists only for explicitly captured, redacted data.
- Produces: `parseSupabaseStatus(json): { apiUrl: string; anonKey: string; serviceRoleKey: string; postgresVersion?: string }`.
- Produces: npm script `db:verify:local`.

- [ ] **Step 1: Unit-test CLI status parsing and secret-safe evidence**

Use synthetic `npx supabase status --output json` fixtures for both current uppercase field names and documented lowercase aliases. Assert returned credentials are usable in memory but `JSON.stringify(toEvidence(...))` contains neither synthetic key nor URL query values. Test child nonzero exit propagation.

- [ ] **Step 2: Implement child process and evidence primitives**

Use `spawnSync(process.execPath, [node_modules npm-cli path or npm exec arguments], { stdio: 'inherit', env })` or `spawnSync('npx', ['supabase', ...], { shell: process.platform === 'win32' })`. Never interpolate command text, and never include environment values in evidence. Return command label, exit code, start/end timestamps, and pass/fail only.

- [ ] **Step 3: Implement guarded local orchestration**

Run these operations sequentially and stop on the first failure:

1. `npx supabase start`;
2. `npx supabase status --output json` captured in memory;
3. verify parsed API hostname is exactly local;
4. `npx supabase db reset --local`;
5. resolve fresh status again after reset;
6. `npx supabase migration list --local`;
7. `npx supabase test db`;
8. run all five existing integration suites plus the fixture, direct-access, ownership, and account-deletion suites with local variables and `DATABASE_PROOF_REQUIRED=true`;
9. `npm run typecheck`;
10. `npm test`;
11. `npm run build`;
12. `npm run openapi:check`.

The dedicated Vitest invocation must use `--reporter=verbose` and fail if any database suite reports skipped tests. Parse Vitest's final summary for `skipped` only in the dedicated invocation; do not reject skips in ordinary `npm test`.

- [ ] **Step 4: Generate sanitized local evidence**

Write `docs/database-proof/local-YYYY-MM-DD.md` only after the run. Include target label, date, Supabase CLI/PostgreSQL versions, local migration versions, command labels, test files/counts, pass/fail status, cleanup status, and recovery notes. Record `blocked` when reset or tests fail. Redact with case-insensitive patterns for `key`, `token`, `password`, `authorization`, JWT-like strings, URLs with query strings, and emails.

- [ ] **Step 5: Add package scripts**

```json
{
  "db:verify:local": "tsx scripts/verify-local-database.ts",
  "db:verify:staging": "tsx scripts/verify-staging-database.ts"
}
```

Add only `db:verify:local` in this task; Task 7 adds the staging target once its file exists.

- [ ] **Step 6: Run unit checks, then the destructive local proof**

Run: `npm test -- tests/database-proof-process.test.ts tests/database-test-environment.test.ts`

Expected: PASS without a database.

Run: `npm run db:verify:local`

Expected: the runner positively identifies localhost, rebuilds from every migration, runs pgTAP and every required integration suite without skips, then passes typecheck/tests/build/OpenAPI and writes sanitized local evidence.

- [ ] **Step 7: Prepare a review boundary**

Inspect scripts, package diff, and generated evidence for secrets before any proposal. If later approved, propose `build(database): add guarded local verification runner`; keep observed evidence in a separate proposed docs commit.

---

### Task 7: Staging Verification Runner and Operator Runbook

**Files:**
- Create: `scripts/verify-staging-database.ts`
- Create: `tests/verify-staging-database.test.ts`
- Create: `docs/database-proof/README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: process/evidence helpers from Task 6 and database environment helpers from Task 1.
- Produces: npm script `db:verify:staging`.
- Produces: a non-reset staging workflow that can stop after dry-run for review or continue only with explicit apply authorization.

- [ ] **Step 1: Unit-test linked target identity checks**

Test that the synthetic URL `https://stagingref123.supabase.co` matches a file containing `stagingref123` in `supabase/.temp/project-ref`; mismatches throw before any mutating command; localhost and HTTP throw; an absent project-ref file throws. Tests must use synthetic references and temporary directories.

- [ ] **Step 2: Implement staging preflight and dry-run mode**

Require all four approved staging environment values. Parse the staging URL, derive its project reference from the hostname, read the linked reference, and require equality. Run `npx supabase projects list --output json` and require the linked reference to be present; do not print project metadata beyond the reference and a `staging` label. Then run `npx supabase migration list --linked` and `npx supabase db push --dry-run`.

Default behavior stops after dry-run and writes a review artifact listing pending migration version filenames and recovery impact. It must not apply migrations merely because `ALLOW_STAGING_DB_TESTS=true`.

- [ ] **Step 3: Add an explicit apply gate**

Require `APPLY_STAGING_MIGRATIONS=true` in addition to the four staging variables before running `npx supabase db push`. This is an operational safeguard for the implementation; the user must separately authorize the concrete reviewed migration list before setting it. After push, rerun `npx supabase migration list --linked` and prove no repository migration remains pending.

- [ ] **Step 4: Run staging smoke suites with required mode**

Pass only staging variables plus `DATABASE_PROOF_REQUIRED=true` to Vitest. Run direct access, fixture lifecycle, ownership, and successful account-deletion suites. Do not run pgTAP failure injection, database reset, or high-concurrency local-only suites on staging. Require zero skipped tests and cleanup success.

- [ ] **Step 5: Write the operator runbook**

Document exact preflight, dry-run, approval, apply, smoke, cleanup, and evidence commands. Include recovery rules: stop dependent deployment; redact and preserve diagnostics; create a reviewed forward-only migration; never edit an applied migration or reset staging. Document how residual fixture IDs are reported by run ID without exposing emails or row contents.

- [ ] **Step 6: Verify non-mutating safety paths**

Run: `npm test -- tests/verify-staging-database.test.ts tests/database-proof-process.test.ts`

Expected: all guard tests PASS.

Run without staging variables: `npm run db:verify:staging`

Expected: exit nonzero before any network or database mutation, with a message naming missing variable names but no values.

When staging variables are configured, run dry-run mode only: `npm run db:verify:staging`

Expected: identity match, migration list, and dry-run complete; no migrations apply and no fixtures are created. Preserve the review artifact for user approval before apply mode.

- [ ] **Step 7: Prepare a review boundary**

Run `git diff --check`. If later approved, propose `build(database): add guarded staging verification` for the runner, tests, package script, and runbook. Do not include staging credentials or generated secret-bearing output.

---

### Task 8: Execute Staging Proof and Close Readiness Point 7

**Files:**
- Create after observed run: `docs/database-proof/staging-YYYY-MM-DD.md`
- Modify: `docs/system-readiness-report-2026-09-07.md`
- Modify: `docs/superpowers/specs/2026-09-08-database-behavior-proof-design.md`
- Modify: `docs/superpowers/plans/2026-09-09-database-behavior-proof.md`

**Interfaces:**
- Consumes: passing local evidence, reviewed staging dry-run, and explicit migration-apply authorization.
- Produces: sanitized staging evidence and an accurate point 7 status.

- [ ] **Step 1: Review the concrete staging dry-run artifact**

Compare every pending version with the repository migration chain. For each pending migration, record auth/RLS/ownership/data/lock impact and the forward-fix path. If the linked target is not positively identified as staging, stop with no mutation.

- [ ] **Step 2: Obtain authorization for the reviewed staging apply**

Present the exact pending migration filenames and recovery notes to the user. Do not set `APPLY_STAGING_MIGRATIONS=true` or apply remote changes until that concrete list is approved.

- [ ] **Step 3: Apply and run staging smoke verification**

With approved staging configuration and apply gate, run: `npm run db:verify:staging`.

Expected: pending repository migrations apply or the target is already current; migration list confirms parity; direct-access, fixture lifecycle, ownership, and deletion smoke suites execute without skips and pass; cleanup succeeds.

- [ ] **Step 4: Inspect staging evidence for secrets and residual fixtures**

Search the artifact for email syntax, JWT structure, `apikey`, `authorization`, `password`, `token`, service-role/anon values, and URL query strings. If cleanup failed, keep point 7 open and record only the random run ID and affected table names needed for manual cleanup.

- [ ] **Step 5: Run the final local quality gate**

Run: `npm run ci`

Run: `npm run build`

Expected: typecheck, ordinary Vitest, OpenAPI check, and build all PASS. Ordinary tests may show only the documented guarded skips when no database variables are supplied.

- [ ] **Step 6: Update readiness and implementation results with observed facts**

Change point 7 only after evidence exists. Record exact command outcomes, migration parity, executed test files/counts, cleanup state, and remaining production boundary. Add matching `Implementation Results` sections to the design and this plan. Do not claim production migration or production data validation.

- [ ] **Step 7: Prepare final commit proposals and review**

Run `git diff --check`, `git status --short`, and focused diffs. Propose numbered Conventional Commit groups with exact files; likely groups are shared helpers/fixtures, direct-access proof, ownership proof, deletion proof, runners/runbook, and observed evidence/readiness docs. Do not stage, commit, or push until the user approves that exact numbered list.

## Final Acceptance Matrix

| Requirement | Proof |
| --- | --- |
| Full migration chain from empty DB | `npm run db:verify:local` completes `supabase db reset --local` and migration list. |
| Existing transaction behavior | Five current local integration suites execute with `DATABASE_PROOF_REQUIRED=true` and zero skips. |
| Catalog RLS and grants | `supabase/tests/database_security.test.sql` passes under pgTAP. |
| Anon/auth table denial | Every table receives failing select/insert/update/delete through real PostgREST clients. |
| Anon/auth RPC denial | Representative valid RPC calls fail specifically for execute permission. |
| Workspace ownership | Two-workspace repository/service matrix passes and target rows remain byte-for-byte equivalent for asserted fields. |
| Account deletion success | Member, replacement-owner, and sole-owner cases pass. |
| Account deletion idempotency | Second call preserves original timestamps and ownership/deletion state. |
| Account deletion atomicity | Forced final-step failure leaves all earlier rows unchanged in pgTAP transaction. |
| Local cleanup | Tagged fixture lifecycle and runner evidence report success. |
| Staging identity and migrations | Linked ref matches URL ref; dry-run reviewed; apply/list shows parity. |
| Staging behavior and cleanup | Required smoke suites pass with zero skips and temporary Auth/application fixtures are removed. |
| General quality | `npm run ci` and `npm run build` pass. |
| Readiness report accuracy | Point 7 cites only observed local/staging evidence and retains production as out of scope. |

## Implementation Results

Implemented on 2026-09-09 without staging or committing files.

- Shared local/staging environment guards, authenticated test clients, UUID-tagged fixtures, and foreign-key-safe cleanup are implemented.
- Direct-access proof covers 20 public application tables and 11 representative RPCs for both anonymous and authenticated roles.
- Workspace proof uses real meeting, participant, task, agreement, membership, and invitation repository/service paths.
- Account deletion proof covers ordinary members, replacement owners, sole owners, idempotency, session/calendar cleanup, retained child data, and forced transaction rollback.
- npm run db:verify:local passed after rebuilding the complete 33-migration chain.
- pgTAP passed 23 assertions across two SQL files.
- Required database Vitest passed 82 tests across nine files with no skips.
- Typecheck, build, and OpenAPI verification passed. The database proof run passed 494 ordinary tests; the final CI run passed 495 after the staging metadata guard test was added.
- The proof produced two forward-only fixes: 20260909120000_harden_public_function_privileges.sql and 20260909130000_fix_ai_rpc_column_ambiguity.sql.
- Staging preflight stopped safely because the linked project is named OurWeek and is also referenced by production environment files. No remote migration list, dry-run, apply, or fixture mutation occurred.
- Task 7 staging execution and Task 8 staging evidence remain open until a distinct project is positively identified as staging.
