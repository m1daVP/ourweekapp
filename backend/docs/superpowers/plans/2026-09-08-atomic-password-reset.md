# Atomic Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make password-reset confirmation safely single-use by atomically consuming the token, changing the password, and revoking every active session.

**Architecture:** Hash the reset code and new password in the Fastify service, then call one service-role-only PostgreSQL RPC. The RPC locks the eligible token and performs all mutations in one transaction; its boolean result distinguishes invalid tokens from successful confirmation without exposing account data.

**Tech Stack:** Node.js 24, TypeScript 7, Fastify 5, Supabase JS 2, PostgreSQL/Supabase migrations, Argon2, Vitest 4.

## Global Constraints

- Preserve `POST /v1/auth/password-reset/confirm` and its successful `204` response.
- Preserve `422 invalid_reset_code` for wrong, expired, consumed, and concurrent-loser requests.
- Map unexpected RPC failures to `500 password_reset_failed` without returning database details.
- Hash the new password outside the database transaction with the existing Argon2 configuration.
- Revoke every active session after a successful reset.
- Add a new forward-only migration; do not edit an applied migration.
- Apply the migration before deploying dependent backend code.
- Never log reset codes, code hashes, passwords, password hashes, refresh tokens, or session data.
- Run database integration tests only against a guarded local Supabase URL on `localhost` or `127.0.0.1`.
- Preserve unrelated working-tree changes in `scripts/generate-secrets.ts`, `AI_PROMPTS.js`, `AI_PROMPTS_PLAN.md`, and `tests/generate-secrets.script.test.ts`.
- Do not stage or commit any task until the user explicitly approves its proposed commit.

## File Map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql` | Defines the atomic, service-role-only password-reset RPC. |
| `tests/password-reset.migration.test.ts` | Guards transaction structure, eligibility checks, and RPC privileges. |
| `src/modules/auth/auth.service.ts` | Hashes inputs, invokes the RPC once, and maps safe API errors. |
| `tests/password-reset.service.test.ts` | Verifies the service RPC contract and removes assumptions about separate table writes. |
| `tests/password-reset.integration.test.ts` | Verifies success, concurrency, single use, and rollback against isolated local Supabase. |
| `docs/system-readiness-report-2026-09-07.md` | Records the verified remediation status and remaining local/staging gates. |
| `docs/superpowers/specs/2026-09-08-atomic-password-reset-design.md` | Records implementation evidence after checks pass. |

---

### Task 1: Add the atomic password-reset database operation

**Files:**
- Create: `supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql`
- Create: `tests/password-reset.migration.test.ts`

**Interfaces:**
- Consumes: `public.password_reset_tokens`, `public.users`, and `public.sessions` from existing migrations.
- Produces: `public.confirm_password_reset(p_code_hash text, p_password_hash text, p_confirmed_at timestamptz) returns boolean`.

- [ ] **Step 1: Write the failing migration-contract tests**

Create `tests/password-reset.migration.test.ts`:

```ts
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql';

describe('atomic password reset migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('locks and validates one eligible reset token', () => {
    expect(sql).toContain('create or replace function public.confirm_password_reset');
    expect(sql).toContain('returns boolean');
    expect(sql).toContain('from public.password_reset_tokens');
    expect(sql).toContain('code_hash = p_code_hash');
    expect(sql).toContain('consumed_at is null');
    expect(sql).toContain('expires_at > p_confirmed_at');
    expect(sql).toContain('for update');
    expect(sql).toContain('return false');
  });

  it('consumes the token, changes the password, and revokes sessions together', () => {
    expect(sql).toContain('update public.password_reset_tokens');
    expect(sql).toContain('set consumed_at = p_confirmed_at');
    expect(sql).toContain('update public.users');
    expect(sql).toContain('set password_hash = p_password_hash');
    expect(sql).toContain('and deleted_at is null');
    expect(sql).toContain("message = 'password_reset_user_not_found'");
    expect(sql).toContain('update public.sessions');
    expect(sql).toContain('set revoked_at = p_confirmed_at');
    expect(sql).toContain('and revoked_at is null');
    expect(sql).toContain('return true');
  });

  it('allows execution only through the backend service role', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain(
      'revoke all on function public.confirm_password_reset(text, text, timestamptz)',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain(
      'grant execute on function public.confirm_password_reset(text, text, timestamptz)',
    );
    expect(sql).toContain('to service_role');
  });
});
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run:

```bash
npm test -- tests/password-reset.migration.test.ts
```

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add the forward-only migration**

Create `supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql`:

```sql
create or replace function public.confirm_password_reset(
  p_code_hash text,
  p_password_hash text,
  p_confirmed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.password_reset_tokens%rowtype;
begin
  if p_code_hash is null
    or pg_catalog.btrim(p_code_hash) = ''
    or p_password_hash is null
    or pg_catalog.btrim(p_password_hash) = ''
    or p_confirmed_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_password_reset_input';
  end if;

  select *
  into v_token
  from public.password_reset_tokens
  where code_hash = p_code_hash
    and consumed_at is null
    and expires_at > p_confirmed_at
  for update;

  if not found then
    return false;
  end if;

  update public.password_reset_tokens
  set consumed_at = p_confirmed_at
  where id = v_token.id;

  update public.users
  set password_hash = p_password_hash
  where id = v_token.user_id
    and deleted_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'password_reset_user_not_found';
  end if;

  update public.sessions
  set revoked_at = p_confirmed_at
  where user_id = v_token.user_id
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function public.confirm_password_reset(text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.confirm_password_reset(text, text, timestamptz)
to service_role;
```

PostgreSQL executes a function call within the caller's transaction. Any raised exception rolls back all three updates. The locked-token predicate is re-evaluated after a concurrent updater commits, so only the first caller receives `true`.

- [ ] **Step 4: Run the migration-contract test**

Run:

```bash
npm test -- tests/password-reset.migration.test.ts
```

Expected: PASS with three tests.

- [ ] **Step 5: Review migration safety**

Run:

```bash
npm run db:migrate:local:dry-run
```

Expected: the new function and grants are the only schema changes. If isolated local Supabase is unavailable, record the command as skipped or failed for that reason and do not point it at staging or production.

- [ ] **Step 6: Prepare the migration commit for approval**

Propose Conventional Commit `feat(auth): add atomic password reset operation` containing only:

```text
supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql
tests/password-reset.migration.test.ts
```

Do not stage or commit until the user explicitly approves this commit.

---

### Task 2: Route reset confirmation through the atomic RPC

**Files:**
- Modify: `src/modules/auth/auth.service.ts:1272-1422`
- Modify: `tests/password-reset.service.test.ts:54-123,294-445`

**Interfaces:**
- Consumes: `public.confirm_password_reset(p_code_hash text, p_password_hash text, p_confirmed_at timestamptz) returns boolean` from Task 1.
- Produces: unchanged `confirmPasswordReset(supabase, body): Promise<void>` behavior for the Fastify route.

- [ ] **Step 1: Replace direct-table expectations with failing RPC expectations**

Extend the test Supabase double so it records RPC calls:

```ts
type RpcResult = { data: boolean | null; error: { message: string } | null };

function createRpcSupabase(result: RpcResult) {
  return {
    supabase: {
      rpc: vi.fn(async () => result),
      from: vi.fn(() => {
        throw new Error('Password reset confirmation must not query tables directly');
      }),
    } as unknown as SupabaseClient,
  };
}
```

Replace the existing confirmation-success test with:

```ts
it('hashes the password and confirms the reset with one RPC call', async () => {
  const { authService, tokenService } = await loadAuthModules();
  const { supabase } = createRpcSupabase({ data: true, error: null });
  const code = 'ABCD2345';

  await expect(authService.confirmPasswordReset(supabase, {
    token: code,
    password: 'new-strong-password',
  })).resolves.toBeUndefined();

  expect(supabase.from).not.toHaveBeenCalled();
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).toHaveBeenCalledWith('confirm_password_reset', {
    p_code_hash: tokenService.hashPasswordResetCode(code),
    p_password_hash: expect.stringMatching(/^\$argon2id\$/),
    p_confirmed_at: expect.any(String),
  });

  const args = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1];
  await expect(
    authService.verifyPassword(args.p_password_hash, 'new-strong-password'),
  ).resolves.toBe(true);
});
```

Add tests that assert `data: false` maps to `422 invalid_reset_code`, an RPC error maps to `500 password_reset_failed`, and a lowercase padded code sends the same hash as uppercase `ABCD2345`.

- [ ] **Step 2: Run the service tests and confirm they fail**

Run:

```bash
npm test -- tests/password-reset.service.test.ts
```

Expected: the new confirmation tests fail because the service still calls `.from()` four times.

- [ ] **Step 3: Implement the one-call service flow**

Remove `PasswordResetTokenRow` if no other code uses it. Replace `confirmPasswordReset` with:

```ts
export async function confirmPasswordReset(
  supabase: SupabaseClient,
  body: PasswordResetConfirmRequestDto,
) {
  const codeHash = hashPasswordResetCode(body.token);
  const passwordHash = await hashPassword(body.password);
  const confirmedAt = new Date().toISOString();
  const { data: confirmed, error } = await supabase.rpc(
    'confirm_password_reset',
    {
      p_code_hash: codeHash,
      p_password_hash: passwordHash,
      p_confirmed_at: confirmedAt,
    },
  );

  if (error) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (confirmed !== true) {
    throw invalidResetCodeError;
  }
}
```

Do not log the RPC error because it may contain database context tied to security-sensitive account state. The global error handler retains the stable client response.

- [ ] **Step 4: Run focused auth tests**

Run:

```bash
npm test -- tests/password-reset.service.test.ts tests/auth.routes.test.ts
```

Expected: PASS. Confirmation uses one RPC call; request-email and route behavior remain unchanged.

- [ ] **Step 5: Run TypeScript verification**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Prepare the service commit for approval**

Propose Conventional Commit `fix(auth): confirm password reset atomically` containing only:

```text
src/modules/auth/auth.service.ts
tests/password-reset.service.test.ts
```

Do not stage or commit until the user explicitly approves this commit.

---

### Task 3: Verify concurrency and rollback against isolated PostgreSQL

**Files:**
- Create: `tests/password-reset.integration.test.ts`

**Interfaces:**
- Consumes: the migrated `confirm_password_reset` RPC from Task 1.
- Produces: guarded local-database evidence for exact single use, all-session revocation, and rollback after token consumption.

- [ ] **Step 1: Add the guarded local fixture**

Follow the existing local-only guard exactly:

```ts
const localUrl = process.env.SUPABASE_LOCAL_URL;
const localServiceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
const localHost = localUrl ? new URL(localUrl).hostname : null;
const canRunLocally = Boolean(
  localUrl &&
  localServiceRoleKey &&
  (localHost === '127.0.0.1' || localHost === 'localhost'),
);
const describeLocal = canRunLocally ? describe : describe.skip;
```

Create one synthetic user per test with an `@local.invalid` email. Insert a token with an HMAC-format synthetic `code_hash`, two active sessions, and one already revoked session. Track created user IDs and delete each user in `afterEach`; cascading foreign keys clean up tokens and sessions.

Use this RPC helper:

```ts
function confirmReset(
  supabase: SupabaseClient,
  fixture: ResetFixture,
  passwordHash: string,
) {
  return supabase.rpc('confirm_password_reset', {
    p_code_hash: fixture.codeHash,
    p_password_hash: passwordHash,
    p_confirmed_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Test successful atomic mutation and session policy**

Call the RPC once and expect `{ data: true, error: null }`. Read back the fixture and assert:

```ts
expect(storedUser?.password_hash).toBe('new-local-password-hash');
expect(storedToken?.consumed_at).toEqual(expect.any(String));
expect(activeSessions.every((session) => session.revoked_at !== null)).toBe(true);
expect(previouslyRevokedSession.revoked_at).toBe(originalRevokedAt);
```

This proves every active device session is invalidated without rewriting an earlier revocation timestamp.

- [ ] **Step 3: Test concurrent single use**

Run two calls concurrently through two independently created Supabase clients:

```ts
const [first, second] = await Promise.all([
  confirmReset(firstClient, fixture, 'first-password-hash'),
  confirmReset(secondClient, fixture, 'second-password-hash'),
]);

expect([first.error, second.error]).toEqual([null, null]);
expect([first.data, second.data].sort()).toEqual([false, true]);
```

Read the user afterward and assert its password hash equals exactly one candidate. Assert the token is consumed and all active sessions are revoked. Call the RPC a third time and assert `data === false`.

- [ ] **Step 4: Test rollback after token consumption**

Create a normal fixture, then soft-delete its user while leaving the token and sessions present. Record the original password hash, token `consumed_at`, and session `revoked_at` values. Call the RPC and expect its error message to contain `password_reset_user_not_found`.

Read all three tables and assert:

```ts
expect(storedUser?.password_hash).toBe(originalPasswordHash);
expect(storedToken?.consumed_at).toBeNull();
expect(storedSessions.map((session) => session.revoked_at)).toEqual(
  originalSessionRevocations,
);
```

The exception occurs after the token update statement, so a null `consumed_at` proves transaction rollback rather than early validation.

- [ ] **Step 5: Run the guarded integration suite**

Run:

```bash
npm test -- tests/password-reset.integration.test.ts
```

Expected with migrated isolated local Supabase: PASS for success, concurrency, and rollback. Expected without guarded local credentials: three tests reported as skipped. A skip is not sufficient to mark the database behavior release-verified.

- [ ] **Step 6: Prepare the integration-test commit for approval**

Propose Conventional Commit `test(auth): verify atomic password reset in PostgreSQL` containing only:

```text
tests/password-reset.integration.test.ts
```

Do not stage or commit until the user explicitly approves this commit.

---

### Task 4: Run release checks and record exact readiness evidence

**Files:**
- Modify: `docs/system-readiness-report-2026-09-07.md:67-75`
- Modify: `docs/superpowers/specs/2026-09-08-atomic-password-reset-design.md`
- Modify: `docs/superpowers/plans/2026-09-08-atomic-password-reset.md`

**Interfaces:**
- Consumes: completed migration, service, and integration-test work from Tasks 1-3.
- Produces: auditable verification results and an explicit boundary between code remediation and deployment readiness.

- [ ] **Step 1: Run focused password-reset checks**

Run:

```bash
npm test -- tests/password-reset.migration.test.ts tests/password-reset.service.test.ts tests/password-reset.integration.test.ts tests/auth.routes.test.ts
```

Expected: all unit, migration, and route tests pass. The integration suite passes only with migrated isolated local Supabase; otherwise its skip must be recorded.

- [ ] **Step 2: Run the backend quality gate**

Run:

```bash
npm run ci
npm run build
```

Expected: typecheck, complete Vitest suite, OpenAPI drift check, and production TypeScript build all pass.

- [ ] **Step 3: Review the complete scoped diff**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check
git -c safe.directory=D:/Projects/myself/weekly-us-api diff -- src/modules/auth/auth.service.ts supabase/migrations/20260908130000_add_atomic_password_reset_confirmation.sql tests/password-reset.service.test.ts tests/password-reset.migration.test.ts tests/password-reset.integration.test.ts docs/system-readiness-report-2026-09-07.md docs/superpowers/specs/2026-09-08-atomic-password-reset-design.md docs/superpowers/plans/2026-09-08-atomic-password-reset.md
```

Expected: no whitespace errors, no direct confirmation-time writes outside the RPC, no secrets, and no unrelated file changes in the scoped diff.

- [ ] **Step 4: Update readiness evidence**

Change point 4 in `docs/system-readiness-report-2026-09-07.md` to identify the migration RPC and service call as implemented. Record exact command results and test counts. If isolated integration tests skipped, state that concurrency and rollback remain unverified against PostgreSQL and keep the pilot gate open. Do not claim that the migration was applied to staging or production.

Add an `Implementation Results` section to the design and this plan with the same command results, test counts, integration status, and remaining migration-before-deploy requirement.

- [ ] **Step 5: Prepare the evidence commit for approval**

Propose Conventional Commit `docs(auth): record atomic password reset verification` containing only:

```text
docs/system-readiness-report-2026-09-07.md
docs/superpowers/specs/2026-09-08-atomic-password-reset-design.md
docs/superpowers/plans/2026-09-08-atomic-password-reset.md
```

Do not stage or commit until the user explicitly approves this commit.

## Deployment Gate

Apply `20260908130000_add_atomic_password_reset_confirmation.sql` to an isolated local environment and then staging before deploying the backend service change. Back up the target database according to `docs/deployment.md`, preview the migration, apply it through the documented Supabase migration process, and verify one successful reset plus invalid reuse in staging. Production migration and deployment require separate explicit authorization.

## Implementation Results

Implemented inline on 8 September 2026 without staging, committing implementation files, or deploying:

- Added the atomic RPC migration and its three migration-contract tests.
- Replaced four independent confirmation queries with one RPC call and updated service tests.
- Added three local-only database tests covering successful mutation, concurrent single use plus later reuse, and rollback after token consumption when the user update fails.
- Preserved the HTTP route, `204` success, `422 invalid_reset_code`, and safe `500 password_reset_failed` contracts.

Observed checks:

- `npm test -- tests/password-reset.integration.test.ts tests/password-reset.service.test.ts tests/password-reset.migration.test.ts --reporter=verbose`: all 16 tests passed against isolated local Supabase.
- The database cases passed for successful mutation, two-request concurrency, later reuse rejection, all-session revocation, and rollback after token consumption when the user update failed.
- `npm run typecheck`: passed.
- `npm run ci`: passed; 64 files passed, 5 files skipped, 469 tests passed, and 12 tests skipped. OpenAPI drift check passed.
- `npm run build`: passed.
- `npm run db:migrate:local`: applied the complete pending chain from `20260711090000` through `20260908130000` successfully after restarting the local Supabase stack with its database volume preserved.

Remaining gate: apply and verify the migration in staging before backend deployment. These results do not establish staging or production migration state.
