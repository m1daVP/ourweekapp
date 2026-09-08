# Explicit Google Account Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop email-based automatic Google account linking and add a safe authenticated Settings flow that preserves both password and Google sign-in.

**Architecture:** Public Google sign-in resolves only an already-linked provider subject or creates a genuinely new account; an email collision returns `account_link_required`. A service-role-only PostgreSQL RPC serializes explicit authenticated links and enforces one Google identity per user. Backend user DTOs expose server-derived sign-in methods, and the mobile Account page uses those methods to render and run the native link flow.

**Tech Stack:** PostgreSQL/Supabase migrations and RPC, Fastify 5, TypeScript, Zod, Vitest, Vue 3, Pinia, Capacitor Google Sign-In, vue-i18n.

## Global Constraints

- Preserve `users.password_hash` and every existing session during Google linking.
- Require an authenticated OurWeek session plus a fresh verified Google ID token; do not require password re-entry.
- Never accept a target user ID, workspace ID, email, or Google subject from the mobile request body.
- Permit only an exact normalized match between the authenticated user's email and the verified Google email.
- Allow at most one Google identity per OurWeek user and one OurWeek user per Google subject.
- Do not add unlinking, password-email verification, account merging, or password-reset changes.
- Keep provider tokens, provider subjects, and account emails out of logs and API error details.
- Deploy backend before mobile so older mobile builds receive the safe `account_link_required` response.
- Do not edit an existing migration; create a new migration under `supabase/migrations`.
- Do not stage or commit files unless the user explicitly approves the exact commit grouping.

---

### Task 1: Add the atomic Google identity linking migration

**Files:**
- Create: `supabase/migrations/20260908120000_add_explicit_google_identity_linking.sql`
- Create: `tests/google-auth-linking.migration.test.ts`
- Create: `tests/google-auth-linking.integration.test.ts`

**Interfaces:**
- Consumes: `public.users` and `public.auth_identities` from existing migrations.
- Produces: `public.link_google_auth_identity(p_user_id uuid, p_provider_subject text, p_email text, p_display_name text, p_avatar_url text)` returning one `public.auth_identities` row; unique constraint `auth_identities_provider_user_unique` on `(provider, user_id)`.

- [ ] **Step 1: Write the migration structure tests**

Create `tests/google-auth-linking.migration.test.ts` to read the new SQL and assert that it contains the guarded duplicate scan, named uniqueness constraint, `security definer`, `set search_path = ''`, `FOR UPDATE` user lock, all three stable conflict messages, and execute revocation/grant:

```ts
expect(sql).toContain('auth_identities_provider_user_unique');
expect(sql).toContain('for update');
expect(sql).toContain("message = 'account_link_email_mismatch'");
expect(sql).toContain("message = 'account_link_conflict'");
expect(sql).toContain("message = 'google_already_linked'");
expect(sql).toContain('revoke all on function public.link_google_auth_identity');
expect(sql).toContain('grant execute on function public.link_google_auth_identity');
```

- [ ] **Step 2: Run the focused migration test and confirm it fails**

Run:

```powershell
npm test -- tests/google-auth-linking.migration.test.ts
```

Expected: failure because the migration does not exist.

- [ ] **Step 3: Write the migration**

Add a `DO` block that aborts when duplicate `(provider, user_id)` groups exist, then add the named constraint. Define the RPC with the following core transaction behavior:

```sql
create or replace function public.link_google_auth_identity(
  p_user_id uuid,
  p_provider_subject text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.auth_identities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_subject_identity public.auth_identities%rowtype;
  v_user_identity public.auth_identities%rowtype;
  v_identity public.auth_identities%rowtype;
  v_email text := lower(btrim(p_email));
begin
  select * into v_user
  from public.users
  where id = p_user_id and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'auth_user_not_found';
  end if;

  if v_user.email_normalized <> v_email then
    raise exception using errcode = 'P0001', message = 'account_link_email_mismatch';
  end if;

  select * into v_subject_identity
  from public.auth_identities
  where provider = 'google' and provider_subject = p_provider_subject;

  if found and v_subject_identity.user_id <> p_user_id then
    raise exception using errcode = 'P0001', message = 'account_link_conflict';
  end if;

  if v_subject_identity.id is not null then
    return v_subject_identity;
  end if;

  select * into v_user_identity
  from public.auth_identities
  where provider = 'google' and user_id = p_user_id;

  if found then
    raise exception using errcode = 'P0001', message = 'google_already_linked';
  end if;

  insert into public.auth_identities (
    user_id, provider, provider_subject, email, email_normalized,
    email_verified, display_name, avatar_url
  ) values (
    p_user_id, 'google', p_provider_subject, v_email, v_email,
    true, nullif(btrim(p_display_name), ''), nullif(btrim(p_avatar_url), '')
  ) returning * into v_identity;

  return v_identity;
end;
$$;
```

Wrap the insert in a nested PL/pgSQL `begin … exception when unique_violation … end` block. After a race loses a uniqueness check, reload by provider subject and by user under the same function call: return the matching same-user/same-subject row, raise `account_link_conflict` when the subject belongs to another user, and raise `google_already_linked` when the user now owns a different subject. Re-raise only when neither named identity constraint explains the violation. Use `nullif(btrim(p_display_name), '')` and `nullif(btrim(p_avatar_url), '')` for the nullable provider fields. Revoke execute from `public`, `anon`, and `authenticated`; grant it to `service_role` only.

- [ ] **Step 4: Add isolated database integration coverage**

Follow the guarded local-Supabase pattern used by the AI integration tests. Create two users, sessions, and identities with synthetic `.invalid` addresses. Assert:

```ts
const [first, second] = await Promise.all([
  serviceClient.rpc('link_google_auth_identity', matchingInput),
  serviceClient.rpc('link_google_auth_identity', matchingInput),
]);
expect([first.error, second.error].filter(Boolean)).toHaveLength(0);
expect(await countGoogleIdentities(userId)).toBe(1);
```

Also test different subjects racing for one user, one subject racing across two users, mismatch rollback, unchanged password hash, unchanged active sessions, and denied RPC execution through anon/authenticated clients.

- [ ] **Step 5: Run migration tests**

Run:

```powershell
npm test -- tests/google-auth-linking.migration.test.ts tests/google-auth-linking.integration.test.ts
```

Expected: structure tests pass; integration tests pass with isolated local Supabase or are explicitly skipped only when the guarded local credentials are absent.

- [ ] **Step 6: Prepare the migration commit for user approval**

Propose Conventional Commit `feat(auth): add atomic Google identity linking` containing only the migration and its migration/integration tests. Do not stage or commit without explicit approval.

---

### Task 2: Make sign-in methods part of the backend auth contract

**Files:**
- Modify: `src/modules/auth/auth.schema.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `tests/schema-validation.test.ts`
- Modify: `tests/auth.service.test.ts`
- Modify: `tests/repository-mappers.test.ts` only if it contains shared auth fixtures affected by the DTO

**Interfaces:**
- Consumes: `users.password_hash` and `auth_identities.provider`.
- Produces: `signInMethodSchema`, `SignInMethodDto`, and required `AuthUserDto.signInMethods: Array<'password' | 'google'>` in stable order.

- [ ] **Step 1: Add failing schema and service tests**

Extend auth schema tests with:

```ts
expect(authUserSchema.parse({ ...validUser, signInMethods: ['password', 'google'] }))
  .toMatchObject({ signInMethods: ['password', 'google'] });
expect(() => authUserSchema.parse({ ...validUser, signInMethods: ['github'] }))
  .toThrow();
```

Update representative registration, password sign-in, Google sign-in, refresh, invitation acceptance, and `/auth/me` service expectations to require the correct method arrays.

- [ ] **Step 2: Run focused tests and confirm contract failures**

Run:

```powershell
npm test -- tests/schema-validation.test.ts tests/auth.service.test.ts
```

Expected: failures because the response schema and mapped users lack `signInMethods`.

- [ ] **Step 3: Extend the Zod contract**

Add:

```ts
export const signInMethodSchema = z.enum(['password', 'google']);

export const authUserSchema = z.object({
  // existing fields
  signInMethods: z.array(signInMethodSchema).min(1),
});

export type SignInMethodDto = z.infer<typeof signInMethodSchema>;
```

- [ ] **Step 4: Derive sign-in methods from database state**

Add a helper that queries Google identity existence for the user and returns `password` when `password_hash` is non-null and `google` when a Google identity exists:

```ts
async function getSignInMethods(
  supabase: SupabaseClient,
  user: Pick<UserRow, 'id' | 'password_hash'>,
): Promise<SignInMethodDto[]> {
  const methods: SignInMethodDto[] = [];
  if (user.password_hash) methods.push('password');
  if (await hasGoogleIdentityForUser(supabase, user.id)) methods.push('google');
  return methods;
}
```

Make `mapAuthUser` accept the derived method list. Update `createSessionResponse`, refresh, and `getCurrentUser` so every returned user contains at least one server-derived method. Map identity lookup failures to a safe `auth_identity_lookup_failed` error.

- [ ] **Step 5: Run focused backend tests**

Run:

```powershell
npm test -- tests/schema-validation.test.ts tests/auth.service.test.ts
```

Expected: pass with password-only, Google-only, and combined method coverage.

- [ ] **Step 6: Prepare the backend contract commit for user approval**

Propose Conventional Commit `feat(auth): expose account sign-in methods` containing the schema, service mapping, and focused tests. Do not stage or commit without explicit approval.

---

### Task 3: Reject automatic linking and add the authenticated link endpoint

**Files:**
- Modify: `src/modules/auth/auth.schema.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/auth/auth.routes.ts`
- Modify: `tests/auth.service.test.ts`
- Modify: `tests/api-contract.routes.test.ts`
- Modify: `tests/auth.register-rate-limit.routes.test.ts` only if its shared route mocks require the new export
- Modify: other auth route mock files that statically mock `auth.service.ts`
- Modify: `docs/openapi.json` through the existing generator

**Interfaces:**
- Consumes: authenticated `request.auth`, `googleSignInRequestSchema`, existing `GoogleAuthProvider`, and the RPC from Task 1.
- Produces: `linkGoogleIdentityForAuthenticatedUser(supabase, auth, body, provider, logger): Promise<AuthUserDto>` and `POST /v1/auth/google/link`.

- [ ] **Step 1: Replace the unsafe behavior test with a failing conflict test**

Change the current “links a verified Google identity to an existing password account by email” test to assert:

```ts
await expect(signInWithGoogle(supabase, { idToken }, provider)).rejects.toMatchObject({
  statusCode: 409,
  code: 'account_link_required',
});
expect(identityInsertOperations).toHaveLength(0);
expect(sessionInsertOperations).toHaveLength(0);
```

Add failing service tests for successful authenticated linking, idempotency, mismatch, ownership conflict, different subject already linked, missing/deleted user, invalid provider token, and safe unexpected-error mapping.

- [ ] **Step 2: Add failing route tests**

Test that `/v1/auth/google/link` requires bearer auth, validates `{ idToken }`, calls the link service with `request.auth`, returns the updated user, and rate-limits the sixth request from one IP to `429` after five attempts in one minute.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
npm test -- tests/auth.service.test.ts tests/api-contract.routes.test.ts
```

- [ ] **Step 4: Stop email-based auto-linking**

Change only the unlinked-subject/existing-email branch in `signInWithGoogle`:

```ts
if (user && !existingIdentity) {
  throw new ApiError(
    409,
    'account_link_required',
    'This email already has an account. Sign in with your password, then link Google from Settings.',
  );
}
```

Keep subject-linked sign-in and genuinely new Google registration unchanged.

- [ ] **Step 5: Implement explicit linking through the RPC**

Verify the ID token first and call:

```ts
await supabase.rpc('link_google_auth_identity', {
  p_user_id: auth.userId,
  p_provider_subject: identity.subject,
  p_email: normalizeEmail(identity.email),
  p_display_name: identity.displayName ?? null,
  p_avatar_url: identity.avatarUrl ?? null,
});
```

Map recognized database messages to the specified `409` errors. Reload the active user and membership and return `mapAuthUser` with freshly derived methods. Never pass a body-owned user ID.

- [ ] **Step 6: Register the authenticated route**

Add `/google/link` with `preHandler: authPreHandler`, `authRequired: true`, the five-per-minute route rate limit, `googleSignInRequestSchema.pick({ idToken: true })`, and `200: authMeResponseSchema`. Include `401`, `409`, `422`, `429`, and `500` response schemas.

- [ ] **Step 7: Generate and validate OpenAPI**

Run:

```powershell
npm run openapi:generate
npm run openapi:check
npm test -- tests/openapi.test.ts tests/api-contract.routes.test.ts tests/auth.service.test.ts
```

Expected: generated document includes the link endpoint and updated auth-user response; focused tests pass.

- [ ] **Step 8: Prepare the explicit-link API commit for user approval**

Propose Conventional Commit `fix(auth): require explicit Google account linking` containing service, route, contract tests, affected mocks, and generated OpenAPI. Do not stage or commit without explicit approval.

---

### Task 4: Update the mobile auth contract and Google collision guidance

**Files:**
- Modify: `src/shared/api/authApi.ts`
- Modify: `src/features/auth/types.ts`
- Modify: `src/app/stores/auth.ts`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: relevant auth store tests under `src/app/stores/__tests__`
- Modify or create focused tests for `SignInPage.vue` and `SignUpPage.vue` if existing coverage does not assert the rendered collision message

**Interfaces:**
- Consumes: backend `AuthUserDto.signInMethods` and `409 account_link_required`.
- Produces: mobile `SignInMethod`, optional compatibility field `AuthUser.signInMethods`, and localized collision guidance.

- [ ] **Step 1: Add failing DTO/parser tests**

Cover valid method arrays, invalid method strings, and a missing method field from an older backend:

```ts
expect(isAuthSessionDto(sessionWith(['password', 'google']))).toBe(true);
expect(isAuthSessionDto(sessionWith(['github']))).toBe(false);
expect(isAuthSessionDto(legacySessionWithoutMethods)).toBe(true);
```

The legacy case is accepted only for rolling compatibility and maps to `undefined`, which the UI treats as unknown.

- [ ] **Step 2: Add failing collision-message tests**

Make the auth store and both Google entry pages assert that an `ApiClientError` with code `account_link_required` renders the localized instruction rather than the generic Google failure.

- [ ] **Step 3: Implement mobile DTO and stored-user mapping**

Add:

```ts
export type SignInMethod = 'password' | 'google';

export interface AuthUserDto {
  // existing fields
  signInMethods?: SignInMethod[];
}

export interface AuthUser {
  // existing fields
  signInMethods?: SignInMethod[];
}
```

Validate array members in `isAuthUserDto`, preserve stable backend order in `mapAuthUser`, and retain compatibility with persisted older users.

- [ ] **Step 4: Add localized collision copy**

Add the same semantic message in English, Ukrainian, and Spanish under `auth.accountLinkRequired`. Extend `getGoogleSignInErrorMessage`:

```ts
case 'account_link_required':
  return translate('auth.accountLinkRequired');
```

- [ ] **Step 5: Run focused mobile tests**

Run the API wrapper, auth store, sign-in, localization, and sign-up tests selected by file name. Expected: all pass with no token logged or persisted.

- [ ] **Step 6: Prepare the mobile contract commit for user approval**

Propose Conventional Commit `fix(auth): explain required Google account linking` containing only contract, mapping, localization, and collision UI tests. Do not stage or commit without explicit approval.

---

### Task 5: Add Google linking to Account Settings

**Files:**
- Modify: `src/shared/api/authApi.ts`
- Modify: `src/app/stores/auth.ts`
- Modify: `src/pages/AccountPage.vue`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: `src/pages/__tests__/AccountPage.test.ts`
- Create: `src/app/stores/__tests__/authGoogleLinking.test.ts`

**Interfaces:**
- Consumes: `getNativeGoogleIdToken()`, authenticated `POST /auth/google/link`, and `AuthUserDto.signInMethods`.
- Produces: `linkGoogleAccountWithIdToken({ idToken }): Promise<AuthUserDto>` and Pinia action `linkGoogleAccount(): Promise<'linked' | 'cancelled' | 'failed'>`.

- [ ] **Step 1: Add failing API wrapper tests**

Assert the wrapper sends only the token and requires auth:

```ts
await linkGoogleAccountWithIdToken({ idToken: 'verified-id-token' });
expect(apiRequest).toHaveBeenCalledWith('/auth/google/link', {
  method: 'POST',
  body: { idToken: 'verified-id-token' },
  requiresAuth: true,
});
```

- [ ] **Step 2: Add failing auth-store linking tests**

Mock the native token provider and API. Cover success updating `user.signInMethods`, cancellation returning `cancelled` without an error, mismatch/conflict localized errors, generic failure, and prevention of overlapping link attempts.

- [ ] **Step 3: Implement the API wrapper and store action**

The action obtains a fresh native ID token, calls the authenticated wrapper, maps the returned user with the existing email fallback, persists it, and returns the explicit outcome. Track linking separately from `authStatus` so the current authenticated session remains usable throughout the operation. Do not reuse the unauthenticated Google exchange or write session tokens.

- [ ] **Step 4: Add failing Account page tests**

Test unknown/loading, password-only, Google-only, and combined method states. Verify the link control is disabled while running, unavailable when native Google is unsupported, success feedback is visible, cancellation is quiet, and safe mismatch/conflict messages are shown.

- [ ] **Step 5: Implement the Account Settings section**

Add a “Sign-in methods” settings section near the account identity controls. Compute server-backed state from `authStore.user?.signInMethods`. Render password and Google status rows. Show `Link Google account` only when method state is known, Google is absent, and native/config support is available. The button calls the new store action and updates `statusMessage`/`formError` without affecting export or deletion state.

- [ ] **Step 6: Add localized Settings copy**

Add English, Ukrainian, and Spanish keys for the section title, connected/available states, link action, linking progress, success, mismatch, conflict, and generic failure. Run the existing locale-catalog completeness test.

- [ ] **Step 7: Run focused mobile tests**

Run:

```powershell
npm test -- src/shared/api/__tests__/apiWrappers.test.ts src/app/stores/__tests__/authGoogleLinking.test.ts src/pages/__tests__/AccountPage.test.ts src/features/localization/__tests__/messages.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Prepare the Account Settings commit for user approval**

Propose Conventional Commit `feat(auth): link Google from account settings` containing the wrapper, store action, Settings UI, localization, and focused tests. Do not stage or commit without explicit approval.

---

### Task 6: Run cross-project release verification and update the readiness evidence

**Files:**
- Modify: `docs/system-readiness-report-2026-09-07.md`
- Modify: `docs/superpowers/specs/2026-09-08-explicit-google-account-linking-design.md` status only after implementation evidence is known

**Interfaces:**
- Consumes: completed backend, migration, OpenAPI, and mobile changes.
- Produces: recorded verification results and remaining deployment/manual gates.

- [ ] **Step 1: Run complete backend checks**

Run:

```powershell
npm run typecheck
npm test
npm run build
npm run openapi:check
```

Expected: all non-guarded checks pass. Guarded local database tests must pass when isolated Supabase credentials are provided; otherwise record them as not executed and keep the database release gate open.

- [ ] **Step 2: Run complete mobile checks**

From `D:/Projects/myself/weekly-us`, run:

```powershell
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npm run build
```

Expected: tests and build pass. Compare explicit type diagnostics with the baseline captured in the readiness report; fix every new diagnostic introduced by this work and record unrelated existing failures separately.

- [ ] **Step 3: Perform manual staging acceptance**

Using synthetic accounts in staging:

1. Register a password account and keep its session active on device A.
2. Attempt Google sign-in with the same email on device B; verify `account_link_required` and no account access.
3. Sign in by password on device A, link matching Google from Account Settings, and verify both existing password session and password credential remain valid.
4. Sign out and sign in with Google; verify the same user and workspace are returned.
5. Attempt to link a different Google email and an identity owned by another test user; verify safe conflict messages and unchanged data.
6. Send simultaneous link requests and confirm one stored identity and stable outcomes.

- [ ] **Step 4: Update the readiness report and design status**

Mark finding 1 as code-remediated only after automated checks pass. Mark it release-verified only after the isolated database and staging scenarios pass. Record exact test counts, skipped checks, deployed revisions, and any limitations without including emails, tokens, subjects, or workspace data.

- [ ] **Step 5: Prepare the evidence commit for user approval**

Propose Conventional Commit `docs(auth): record Google linking verification` containing only the readiness/design evidence updates. Do not stage or commit without explicit approval.
