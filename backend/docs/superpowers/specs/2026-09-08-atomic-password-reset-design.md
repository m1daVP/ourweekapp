# Atomic Password Reset Design

**Date:** 2026-09-08  
**Status:** Implemented and verified against isolated local PostgreSQL
**Readiness finding:** `docs/system-readiness-report-2026-09-07.md`, point 4

## Objective

Make password reset confirmation atomic and safely single-use. Exactly one request may use a reset token successfully, including when requests run concurrently. A successful reset changes the password and revokes every existing session for the user. A failed reset leaves the token, password, and sessions in their prior state.

## Scope

This change covers the backend password-reset confirmation path only:

- add a forward-only Supabase migration containing the atomic database operation;
- change the auth service to call that operation;
- preserve the existing HTTP endpoint and response contract;
- add service, migration-contract, and guarded isolated-database integration tests;
- record verified readiness evidence after implementation.

The password-reset request and email flow, reset-code format and lifetime, password policy, mobile screens, and sign-in behavior are unchanged.

## Database Operation

Add `public.confirm_password_reset` as a PostgreSQL function called only by the backend service role. Its inputs are the normalized reset-code hash, the Argon2 password hash, and the operation timestamp. Password hashing remains in Node.js so the database transaction stays short.

The function runs the following work in one transaction:

1. Select and lock the token matching the supplied code hash when it is unconsumed and unexpired.
2. Return `false` when no eligible token exists. This includes wrong, expired, already consumed, and concurrently consumed tokens.
3. Mark the locked token as consumed using the supplied timestamp.
4. Update the owning user's password hash.
5. Revoke all of that user's sessions whose `revoked_at` is null using the same timestamp.
6. Return `true`.

The token row lock serializes requests for the same token. After the first transaction commits, a waiting request re-evaluates token eligibility, observes `consumed_at`, and returns `false`. If any mutation raises an error, PostgreSQL rolls the whole function call back, so the token cannot be consumed independently of the password update and session revocation.

The function must treat a missing or soft-deleted owning user as an internal consistency failure and raise an exception. This rolls back token consumption and prevents reporting a successful reset for an unusable account.

## Security

The function will:

- use `SECURITY DEFINER`;
- set `search_path = ''`;
- fully qualify tables and database functions;
- revoke execution from `PUBLIC`, `anon`, and `authenticated`;
- grant execution only to `service_role`.

The function returns only a boolean and does not expose the user ID, token row, password hash, or session data. The service must not log the reset code, code hash, password, password hash, or session tokens.

## Service Flow And Errors

`confirmPasswordReset` will:

1. Normalize and hash the submitted reset code using the existing helper.
2. Hash the new password with the existing Argon2 configuration.
3. Call `confirm_password_reset` once through Supabase RPC.
4. Complete normally only when the RPC returns `true`.

A `false` result maps to the existing `422 invalid_reset_code` error and message. This keeps wrong, expired, consumed, and concurrent-loser requests indistinguishable.

An RPC/database error maps to the existing safe `500 password_reset_failed` response. Provider or database details are not returned to the client. The old `session_revoke_failed` partial-operation branch is removed because session revocation becomes part of the single atomic database operation.

The HTTP route remains `POST /v1/auth/password-reset/confirm` and continues returning `204` after success.

## Rollout

The migration is additive and does not alter existing tables, RLS policies, or reset-token data. Apply the migration before deploying service code that calls the new RPC. The previous backend remains compatible while the migration is present, so rollout follows expand then deploy. Removing the old direct-query implementation requires no database contraction step.

Rollback uses a forward fix: redeploying the previous backend remains possible while the RPC exists. A later migration may remove the RPC only after no deployed backend version depends on it.

## Tests

Add focused coverage for:

- migration structure: function signature, row lock, eligibility predicates, atomic token/password/session updates, fixed search path, and restricted grants;
- service success: password hashing happens before one RPC call and no direct table mutation remains;
- service invalid result: `false` maps to `422 invalid_reset_code`;
- service database failure: RPC errors map to `500 password_reset_failed`;
- isolated database success: the password changes, every active session is revoked, and the token is consumed;
- isolated database concurrency: two simultaneous confirmations with the same token yield exactly one success and one invalid result;
- isolated database rollback: an injected failure during the function leaves the token unconsumed, password unchanged, and sessions active.

The database integration suite must be guarded by the repository's local-test environment checks and use only isolated local Supabase credentials. It may skip when those credentials are absent; staging or production credentials must never be used for these tests. Readiness point 4 is code-remediated after automated service and migration tests pass, but release verification remains open until the isolated database concurrency and rollback cases pass on the migrated schema.

## Acceptance Criteria

- One reset token authorizes at most one successful password reset.
- Password update, token consumption, and revocation of all active sessions commit or roll back together.
- A successful reset requires the user to sign in again on every device.
- The public endpoint and its `204`, `422`, and safe `500` behavior remain stable.
- The RPC is unavailable to public client roles.
- No reset or session secret is returned or logged.
- The migration is applied before the dependent backend is deployed.

## Implementation Results

Implemented on 8 September 2026:

- Added `20260908130000_add_atomic_password_reset_confirmation.sql` with the locked, atomic, service-role-only RPC.
- Changed `confirmPasswordReset` to hash outside the database transaction and use one RPC call.
- Added migration-contract, service, and guarded local-database coverage for success, concurrency, reuse, all-session revocation, and rollback.
- Preserved the existing route and public error contracts.

Verification:

- Focused password-reset suites: all 16 tests passed after the complete pending migration chain was applied to isolated local Supabase.
- Local PostgreSQL verification passed for successful mutation, two-request concurrency, later reuse rejection, all-session revocation, and rollback after token consumption when the user update failed.
- `npm run typecheck`: passed.
- `npm run ci`: passed with 469 tests passed and 12 guarded integration tests skipped across the repository; OpenAPI check passed.
- `npm run build`: passed.

The initial local migration connection failed because the Docker host-port proxy was terminating connections. Restarting the local Supabase stack while preserving its database volume repaired connectivity. The CLI then applied migrations `20260711090000` through `20260908130000` successfully, and the three password-reset database tests passed. Staging verification and deployment remain separate: apply the migration in staging and verify success, invalid reuse, and all-device sign-out before deploying the dependent backend.
