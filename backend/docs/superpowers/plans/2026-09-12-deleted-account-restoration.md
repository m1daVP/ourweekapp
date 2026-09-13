# Deleted Account Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell a deleted password-account user how to reach support and give the project owner a safe service-role CLI to restore that account and its appropriate workspace access.

**Architecture:** Password sign-in will fetch the matching user including soft-deleted rows, verify the password before revealing the deleted state, and return a stable `account_deleted` API error only for a verified deleted account. A forward-only PostgreSQL RPC will restore the user and all memberships that account deletion marked `removed`; it restores a soft-deleted workspace only where the restored user remains its owner and otherwise restores them as `adult_member`. A local TypeScript CLI validates one email, invokes the service-role RPC, and prints only a compact operation summary.

**Tech Stack:** Node.js 24, TypeScript, Fastify, Zod, Supabase JS, PostgreSQL/PLpgSQL, Vitest, pgTAP.

## Global Constraints

- Keep the existing soft-delete model and global email uniqueness constraints; deleted emails cannot be registered again.
- Return `account_deleted` with exactly `This account was deleted. To restore it, email ourweekapp@gmail.com.` only after a deleted user’s password is verified.
- Unknown emails, incorrect passwords, and Google-only password attempts keep the existing generic `invalid_credentials` response.
- The restoration RPC must be atomic, idempotent, and executable only by `service_role`.
- Restore no sessions, refresh tokens, calendar credentials, or provider tokens.
- If the restored user is still a workspace owner, restore that soft-deleted workspace and their `owner` membership; otherwise restore active workspace membership as `adult_member` without changing its current owner.
- The command is local, requires the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and must never log credentials, hashes, or raw database errors.
- Do not stage, commit, push, or modify an already-applied migration.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/modules/auth/auth.service.ts` | Verifies deleted password accounts before returning the support-directed API error. |
| `tests/auth.service.test.ts` | Covers deleted-account, unknown-email, and wrong-password sign-in responses. |
| `supabase/migrations/20260912120000_create_account_restore_rpc.sql` | Adds the transaction-safe, service-role-only restore RPC. |
| `tests/account-restore.migration.test.ts` | Guards the expected restore-RPC shape and permissions in the migration. |
| `tests/account-restore.integration.test.ts` | Proves real database restoration, ownership preservation, idempotency, and credential non-restoration. |
| `supabase/tests/database_security.test.sql` | Verifies that anonymous and authenticated roles cannot execute the restore RPC. |
| `scripts/restore-deleted-account.ts` | Project-owner CLI wrapper around the restore RPC. |
| `tests/restore-deleted-account.script.test.ts` | Covers CLI argument validation, user lookup, safe output, and RPC invocation. |
| `package.json` | Exposes the CLI as `npm run account:restore -- --email <email>`. |
| `docs/account-restoration.md` | Owner runbook with prerequisites, command, success behavior, and recovery limitations. |

### Task 1: Return a support-directed error only for a verified deleted password account

**Files:**
- Modify: `src/modules/auth/auth.service.ts:286-324,1004-1027`
- Modify: `tests/auth.service.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail`, `verifyPassword`, `ApiError`, and the existing `UserRow` type.
- Produces: `signInUser(supabase, body): Promise<AuthSessionDto>` can throw `ApiError(401, 'account_deleted', 'This account was deleted. To restore it, email ourweekapp@gmail.com.')`.

- [ ] **Step 1: Write failing service tests for the three password-sign-in branches**

```ts
it('returns the support-directed error for a deleted account after verifying its password', async () => {
  const { authService } = await loadAuthModules();
  const supabase = createSequentialSupabase([
    { data: { ...passwordUser, deleted_at: '2026-09-12T10:00:00.000Z' }, error: null },
  ]);

  await expect(authService.signInUser(supabase, {
    email: passwordUser.email,
    password: 'correct-password',
  })).rejects.toMatchObject({
    statusCode: 401,
    code: 'account_deleted',
    message: 'This account was deleted. To restore it, email ourweekapp@gmail.com.',
  });
});

it('keeps an incorrect password for a deleted account generic', async () => {
  const { authService } = await loadAuthModules();
  const supabase = createSequentialSupabase([
    { data: { ...passwordUser, deleted_at: '2026-09-12T10:00:00.000Z' }, error: null },
  ]);

  await expect(authService.signInUser(supabase, {
    email: passwordUser.email,
    password: 'wrong-password',
  })).rejects.toMatchObject({ code: 'invalid_credentials' });
});

it('keeps an unknown email generic', async () => {
  const { authService } = await loadAuthModules();
  const supabase = createSequentialSupabase([{ data: null, error: null }]);

  await expect(authService.signInUser(supabase, {
    email: 'missing@example.com',
    password: 'correct-password',
  })).rejects.toMatchObject({ code: 'invalid_credentials' });
});
```

- [ ] **Step 2: Run the focused test file to verify the new deleted-account test fails**

Run: `npx vitest run tests/auth.service.test.ts`

Expected: FAIL because the current email lookup excludes deleted users and sign-in returns generic credentials failure.

- [ ] **Step 3: Replace the active-only email lookup with an inclusive lookup and gate disclosure on password verification**

```ts
async function getUserByEmailIncludingDeleted(
  supabase: SupabaseClient,
  email: string,
) {
  const { data, error } = await supabase
    .from('users')
    .select('id,email,display_name,password_hash,created_at,updated_at,deleted_at')
    .eq('email_normalized', normalizeEmail(email))
    .returns<UserRow[]>()
    .maybeSingle();

  if (error) throw new ApiError(500, 'auth_lookup_failed', 'Something went wrong. Please try again.');
  return data;
}

const deletedAccountFailure = new ApiError(
  401,
  'account_deleted',
  'This account was deleted. To restore it, email ourweekapp@gmail.com.',
);

// In signInUser, verify `user.password_hash` before this branch:
if (user.deleted_at) throw deletedAccountFailure;
```

Keep `getUserById` active-only for authenticated paths and do not alter registration’s unique-violation mapping.

- [ ] **Step 4: Run the focused service tests**

Run: `npx vitest run tests/auth.service.test.ts`

Expected: PASS, including existing password and Google sign-in assertions.

- [ ] **Step 5: Run the auth route and OpenAPI contract tests**

Run: `npx vitest run tests/api-contract.routes.test.ts tests/openapi.test.ts`

Expected: PASS. The established `401` error response schema already describes the new error code without a route-shape change.

### Task 2: Add the transactional, service-role-only account restoration RPC

**Files:**
- Create: `supabase/migrations/20260912120000_create_account_restore_rpc.sql`
- Create: `tests/account-restore.migration.test.ts`
- Modify: `supabase/tests/database_security.test.sql`

**Interfaces:**
- Consumes: `public.users`, `public.workspaces`, and `public.workspace_members` soft-delete/status records.
- Produces: `public.account_restore(p_user_id uuid) returns table(restored_workspace_count integer, restored_membership_count integer)`; only `service_role` can execute it.

- [ ] **Step 1: Write a migration shape test before adding the migration**

```ts
it('adds a service-role-only transactional account restore RPC', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  expect(sql).toContain('create or replace function public.account_restore');
  expect(sql).toContain('for update');
  expect(sql).toContain("set deleted_at = null");
  expect(sql).toContain("set status = 'active'");
  expect(sql).toContain("set role = 'adult_member'");
  expect(sql).toContain('revoke all on function public.account_restore(uuid) from public');
  expect(sql).toContain('grant execute on function public.account_restore(uuid) to service_role');
});
```

- [ ] **Step 2: Add the pgTAP privilege assertion**

```sql
select ok(
  not has_function_privilege('anon', 'public.account_restore(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.account_restore(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.account_restore(uuid)', 'EXECUTE'),
  'account restoration is service-role only'
);
```

- [ ] **Step 3: Run the migration-shape test to verify it fails**

Run: `npx vitest run tests/account-restore.migration.test.ts`

Expected: FAIL because the forward-only migration does not exist.

- [ ] **Step 4: Implement the lock-and-restore transaction in a new migration**

```sql
create or replace function public.account_restore(p_user_id uuid)
returns table(restored_workspace_count integer, restored_membership_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user public.users%rowtype;
  workspace_record record;
begin
  select * into target_user from public.users where id = p_user_id for update;
  if not found or target_user.deleted_at is null then
    raise exception using errcode = 'P0002', message = 'deleted_account_not_found';
  end if;

  update public.users set deleted_at = null where id = p_user_id and deleted_at is not null;

  restored_workspace_count := 0;
  restored_membership_count := 0;
  for workspace_record in
    select w.id, w.owner_id, w.deleted_at
      from public.workspaces w
      join public.workspace_members wm on wm.workspace_id = w.id
     where wm.user_id = p_user_id and wm.status = 'removed'
     for update of w, wm
  loop
    if workspace_record.deleted_at is not null
       and workspace_record.owner_id = p_user_id then
      update public.workspaces set deleted_at = null where id = workspace_record.id;
      restored_workspace_count := restored_workspace_count + 1;
    end if;

    if workspace_record.deleted_at is null or workspace_record.owner_id = p_user_id then
      update public.workspace_members
         set status = 'active',
             role = case when workspace_record.owner_id = p_user_id then 'owner' else 'adult_member' end
       where workspace_id = workspace_record.id
         and user_id = p_user_id
         and status = 'removed';
      restored_membership_count := restored_membership_count + 1;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.account_restore(uuid) from public;
grant execute on function public.account_restore(uuid) to service_role;
```

The final SQL must retain the `FOR UPDATE OF w, wm` candidate-row lock shown above and include no updates to `sessions` or `calendar_connections`.

- [ ] **Step 5: Run static migration and database privilege checks**

Run: `npx vitest run tests/account-restore.migration.test.ts && npx supabase test db`

Expected: PASS after a local database reset has applied the new migration.

### Task 3: Prove restoration behavior against a real Supabase database

**Files:**
- Create: `tests/account-restore.integration.test.ts`
- Modify: `scripts/verify-local-database.ts:93-104`

**Interfaces:**
- Consumes: `AccountRepository.deleteAccountAtomically(userId, deletedAt)`, `public.account_restore(uuid)`, and the fixture/cleanup helpers.
- Produces: repeatable local/staging proof that restoration preserves current ownership and does not recreate credentials.

- [ ] **Step 1: Write failing integration scenarios using the existing account-deletion fixture pattern**

```ts
it('restores a sole owner and its soft-deleted workspace without restoring sessions or calendar tokens', async () => {
  const scenario = await createScenario('sole-owner');
  tracker = scenario.tracker;
  await repository.deleteAccountAtomically(scenario.deletingUserId, deletedAt);

  const { data, error } = await client.rpc('account_restore', {
    p_user_id: scenario.deletingUserId,
  });
  requireDatabaseSuccess(error, 'account restore');

  expect(data).toEqual([{ restored_workspace_count: 1, restored_membership_count: 1 }]);
  expect((await client.from('users').select('deleted_at').eq('id', scenario.deletingUserId).single()).data)
    .toEqual({ deleted_at: null });
  expect((await client.from('workspaces').select('deleted_at,owner_id').eq('id', scenario.workspaceIds[0]).single()).data)
    .toEqual({ deleted_at: null, owner_id: scenario.deletingUserId });
  expect((await client.from('workspace_members').select('role,status').eq('workspace_id', scenario.workspaceIds[0]).eq('user_id', scenario.deletingUserId).single()).data)
    .toEqual({ role: 'owner', status: 'active' });
  expect((await client.from('sessions').select('revoked_at').eq('id', scenario.activeSessionId).single()).data?.revoked_at)
    .toBe(deletedAt);
  expect((await client.from('calendar_connections').select('access_token_encrypted,refresh_token_encrypted').eq('id', scenario.calendarConnectionId).single()).data)
    .toEqual({ access_token_encrypted: null, refresh_token_encrypted: null });
});

it('restores a transferred owner as adult_member without changing the replacement owner', async () => {
  const scenario = await createScenario('replacement-owner');
  tracker = scenario.tracker;
  await repository.deleteAccountAtomically(scenario.deletingUserId, deletedAt);
  requireDatabaseSuccess((await client.rpc('account_restore', { p_user_id: scenario.deletingUserId })).error, 'account restore');

  expect((await client.from('workspaces').select('owner_id,deleted_at').eq('id', scenario.workspaceIds[0]).single()).data)
    .toEqual({ owner_id: scenario.replacementUserId, deleted_at: null });
  expect((await client.from('workspace_members').select('role,status').eq('workspace_id', scenario.workspaceIds[0]).eq('user_id', scenario.deletingUserId).single()).data)
    .toEqual({ role: 'adult_member', status: 'active' });
});

it('is idempotent by rejecting a second restore after the user is active', async () => {
  const scenario = await createScenario('sole-owner');
  tracker = scenario.tracker;
  await repository.deleteAccountAtomically(scenario.deletingUserId, deletedAt);
  requireDatabaseSuccess((await client.rpc('account_restore', { p_user_id: scenario.deletingUserId })).error, 'first account restore');
  const before = await client.from('workspaces').select('owner_id,deleted_at').eq('id', scenario.workspaceIds[0]).single();
  const second = await client.rpc('account_restore', { p_user_id: scenario.deletingUserId });

  expect(second.error?.code).toBe('P0002');
  expect(await client.from('workspaces').select('owner_id,deleted_at').eq('id', scenario.workspaceIds[0]).single())
    .toEqual(before);
});
```

- [ ] **Step 2: Run the integration suite with local proof credentials to verify failure**

Run: `npm run db:verify:local`

Expected: FAIL at `tests/account-restore.integration.test.ts` until the migration has been applied and the behavior exists.

- [ ] **Step 3: Add the suite to the mandatory local proof process**

```ts
const integrationFiles = [
  'tests/ai-summary-generation-claim.integration.test.ts',
  'tests/ai-summary-generation-finalization.integration.test.ts',
  'tests/ai-stale-reservation-recovery.integration.test.ts',
  'tests/google-auth-linking.integration.test.ts',
  'tests/password-reset.integration.test.ts',
  'tests/database-proof-fixtures.integration.test.ts',
  'tests/database-direct-access.integration.test.ts',
  'tests/database-workspace-ownership.integration.test.ts',
  'tests/account-deletion.integration.test.ts',
  'tests/account-restore.integration.test.ts',
];
```

- [ ] **Step 4: Reset the local database and run the full database proof**

Run: `npm run db:verify:local`

Expected: PASS with no skipped required integration suite. The generated evidence must report the full run without credentials.

### Task 4: Add the local project-owner restoration command

**Files:**
- Create: `scripts/restore-deleted-account.ts`
- Create: `tests/restore-deleted-account.script.test.ts`
- Modify: `package.json:6-30`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `createServiceRoleSupabaseClient(url, key)`, and `account_restore(p_user_id uuid)`.
- Produces: `npm run account:restore -- --email name@example.com`, exit status `0` on success and `1` for invalid input, missing/deleted-user lookup failures, or restoration failure.

- [ ] **Step 1: Write failing script tests with a mock client factory**

```ts
it('normalizes the email and calls account_restore for a deleted user', async () => {
  const result = await restoreDeletedAccount({
    email: '  OWNER@EXAMPLE.COM ',
    supabase: mockSupabaseWithDeletedUser('user-1'),
  });

  expect(result).toEqual({ userId: 'user-1', restoredWorkspaceCount: 1, restoredMembershipCount: 1 });
  expect(mockRpc).toHaveBeenCalledWith('account_restore', { p_user_id: 'user-1' });
});

it('rejects an active or unknown account without calling the RPC', async () => {
  await expect(restoreDeletedAccount({
    email: 'active@example.com',
    supabase: mockSupabaseWithActiveUser('user-2'),
  })).rejects.toThrow('No deleted account matches that email address.');
  expect(mockRpc).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the script tests to verify failure**

Run: `npx vitest run tests/restore-deleted-account.script.test.ts`

Expected: FAIL because the command module and `restoreDeletedAccount` export do not exist.

- [ ] **Step 3: Implement the command with strict argument parsing and safe output**

```ts
export async function restoreDeletedAccount(input: {
  email: string;
  supabase: SupabaseClient;
}): Promise<{ userId: string; restoredWorkspaceCount: number; restoredMembershipCount: number }> {
  const email = normalizeEmail(input.email);
  const { data: user, error } = await input.supabase
    .from('users')
    .select('id,deleted_at')
    .eq('email_normalized', email)
    .maybeSingle();

  if (error || !user || !user.deleted_at) throw new Error('No deleted account matches that email address.');
  const { data, error: restoreError } = await input.supabase
    .rpc('account_restore', { p_user_id: user.id });
  if (restoreError || !data?.[0]) throw new Error('Account restoration could not be completed.');

  return { userId: user.id, restoredWorkspaceCount: data[0].restored_workspace_count, restoredMembershipCount: data[0].restored_membership_count };
}
```

The executable entry point must parse exactly `--email <address>`, write a one-line success result without the address or user ID, write safe failures to stderr, and set `process.exitCode = 1` on error. Import only the narrow environment/client modules required by the command; do not boot Fastify.

- [ ] **Step 4: Register the npm command**

```json
"account:restore": "tsx scripts/restore-deleted-account.ts"
```

- [ ] **Step 5: Run focused CLI tests and a typecheck**

Run: `npx vitest run tests/restore-deleted-account.script.test.ts && npm run typecheck`

Expected: PASS. Verify that captured stdout/stderr contains neither the service-role key nor the supplied email.

### Task 5: Publish the owner runbook and complete regression verification

**Files:**
- Create: `docs/account-restoration.md`
- Modify: `docs/deployment.md:136-150`

**Interfaces:**
- Consumes: the `account:restore` npm script and the deployed `account_restore(uuid)` RPC.
- Produces: an operator procedure that can be followed without reading source code.

- [ ] **Step 1: Write the runbook with the exact restoration command and expected outcome**

```md
## Restore a deleted account

From a trusted backend checkout with production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` loaded:

```powershell
npm run account:restore -- --email person@example.com
```

The command restores a deleted user, reactivates the workspace they solely owned if it was soft-deleted, and restores their active membership without reclaiming a workspace whose ownership was transferred. It does not restore sessions or Google Calendar credentials. Ask the user to sign in again and reconnect Google Calendar if they used it.
```

- [ ] **Step 2: Add the deployment preflight and recovery note**

```md
Apply the `account_restore` migration before using `account:restore`. Run the command only after confirming the support request controls the email address. The tool is service-role-only; never paste its credentials into a client, ticket, or chat.
```

- [ ] **Step 3: Run all non-destructive project checks**

Run: `npm run typecheck && npm test && npm run build && npm run openapi:check`

Expected: PASS.

- [ ] **Step 4: Run local database proof after migration review**

Run: `npm run db:verify:local`

Expected: PASS. Do not run a staging or production restore without explicit operator approval and an account-specific support request.

## Plan Self-Review

- Spec coverage: Task 1 covers the exact user-facing deleted-account message and preserves generic credential handling. Tasks 2 and 3 cover atomic, service-role-only restoration, ownership rules, idempotency, and credential non-restoration. Task 4 supplies the project-owner command. Task 5 documents operation and validates the release.
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation references remain.
- Type consistency: the plan consistently names the RPC `account_restore(uuid)`, the CLI export `restoreDeletedAccount`, and the returned count fields `restoredWorkspaceCount` and `restoredMembershipCount`.
