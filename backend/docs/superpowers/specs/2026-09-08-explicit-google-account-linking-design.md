# Explicit Google Account Linking Design

**Date:** 2026-09-08

**Status:** Approved

## Problem

Password registration currently creates an active account without verifying ownership of the submitted email address. Later, a first Google sign-in with the same verified email automatically links the Google identity to that password account and leaves the password credential and existing sessions valid.

This creates an account pre-registration vulnerability. A person can register someone else's email with a password, and the legitimate email owner can later sign in with Google while the original password and sessions continue to access the same account.

OurWeek must retain both password and Google access after a legitimate link. Google sign-in must therefore stop linking by email automatically. Linking will be an explicit action from Account Settings while the user is already authenticated.

## Goals

- Prevent ordinary Google sign-in from attaching a new Google identity to an existing password account by email.
- Let an authenticated user explicitly link a matching verified Google identity from Account Settings.
- Preserve the user's password credential and existing sessions after linking.
- Report the account's configured sign-in methods from backend-owned state.
- Make concurrent and repeated link requests deterministic and safe.
- Keep new Google-user registration and sign-in through an existing Google identity working.

## Non-goals

- Email verification for password registration.
- Requiring password re-entry before linking.
- Unlinking Google or removing the password sign-in method.
- Merging two existing OurWeek accounts or their households.
- Allowing multiple Google identities on one OurWeek account.
- Changing password-reset behavior as part of this work.

## Chosen approach

Ordinary Google sign-in remains a public authentication endpoint. It first resolves the verified Google provider subject. If that subject is already linked, it signs in the linked user. If it is new and no OurWeek account uses the verified email, it creates a Google-only account as today. If it is new and the verified email belongs to an existing account, it returns a stable `409 account_link_required` error without writing an identity or creating a session.

An authenticated `POST /v1/auth/google/link` endpoint accepts a fresh Google ID token. The service verifies the token using the existing Google verifier, then delegates the database mutation to one service-role-only PostgreSQL function. The link is allowed only when the verified normalized Google email exactly equals the authenticated user's normalized account email.

The link operation does not change `users.password_hash`, revoke sessions, issue a new session, move workspaces, or accept invitations. After it succeeds, both password and Google sign-in remain available.

## Backend API contract

### Ordinary Google sign-in

`POST /v1/auth/google` retains its existing request and successful session response.

When the verified Google subject is not linked and its email matches an existing user, it returns:

```json
{
  "message": "This email already has an account. Sign in with your password, then link Google from Settings.",
  "code": "account_link_required",
  "details": {}
}
```

The status is `409`. The response does not reveal anything beyond the fact already implied by the attempted verified Google email. No Google identity, user, session, invitation acceptance, workspace, or participant is created or changed.

### Explicit link

`POST /v1/auth/google/link` requires the existing bearer authentication middleware and accepts:

```json
{
  "idToken": "fresh Google ID token"
}
```

It returns HTTP `200` with the updated authenticated user DTO. The DTO includes:

```json
{
  "signInMethods": ["password", "google"]
}
```

The complete response continues to contain the existing user fields. The method order is stable: `password`, then `google`. The same Google identity linked to the same user is an idempotent success.

Expected link errors are:

- `401 invalid_google_token`: the provider token cannot be verified or lacks a verified email.
- `401 unauthenticated` or `invalid_session`: the OurWeek session is absent or no longer valid.
- `409 account_link_email_mismatch`: the verified Google email differs from the signed-in account email.
- `409 account_link_conflict`: the Google subject is linked to another OurWeek user.
- `409 google_already_linked`: the current user already has a different Google subject linked.
- `500 auth_identity_link_failed`: an unexpected database failure, with provider and database details withheld from the client.

The endpoint uses the existing Google authentication limit: five requests per client IP per minute.

### Sign-in method state

`AuthUserDto` gains required `signInMethods`, an array containing one or both of `password` and `google`. Backend responses derive it from `users.password_hash` and `auth_identities`; the client never infers it from the button the user pressed.

All endpoints returning `AuthUserDto`, including registration, password sign-in, Google sign-in, refresh, invitation acceptance, and `/auth/me`, populate the field. Adding this response field is backward-compatible for already released clients.

The mobile decoder accepts the new field and treats a missing field from an older backend as an unknown/loading state rather than falsely claiming a method is linked or unlinked. The production rollout order is backend first, then mobile.

## Database design

A new migration adds a unique constraint covering `(provider, user_id)` so one user can have at most one Google identity. The existing `(provider, provider_subject)` uniqueness continues to ensure one Google subject belongs to at most one user.

Before creating the new uniqueness rule, the migration checks for duplicate `(provider, user_id)` groups. If any exist, it raises a descriptive exception and stops. The migration does not delete identities or choose a winner. Existing duplicates must be reviewed and corrected through an explicit, audited recovery before retrying the migration.

The migration creates a service-role-only PostgreSQL function named `public.link_google_auth_identity(p_user_id uuid, p_provider_subject text, p_email text, p_display_name text, p_avatar_url text)`. It returns the resulting `auth_identities` row. The function:

1. Locks and loads the target active `users` row by the authenticated user ID supplied by the trusted backend.
2. Normalizes and compares the account email with the verified provider email.
3. Loads any Google identity for the provider subject and any Google identity for the user.
4. Returns success when the same subject is already linked to the same user.
5. Raises SQLSTATE `P0001` with, respectively, `account_link_email_mismatch`, `account_link_conflict`, or `google_already_linked` for email mismatch, subject ownership conflict, or a different Google identity already linked to the user.
6. Inserts the verified identity when no conflict exists.
7. Returns the resulting identity row or a small success record used by the service.

Locking the user row serializes competing link attempts for the same user. Database uniqueness resolves competing attempts involving the same provider subject across different users. The service maps recognized database outcomes to the stable API errors above.

The function uses `security definer`, an explicit `search_path`, and fully qualified object names. Execute permission is revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`, matching the backend-only database access model. No client-supplied email or subject is trusted until the backend has verified the Google token.

## Service flow

### Public Google sign-in

1. Verify the ID token and require Google's `email_verified=true` through the existing provider client.
2. Look up the Google identity by provider subject.
3. If linked, load the linked active user and membership and issue a session.
4. If unlinked, look up an active user by normalized email.
5. If a user exists, throw `account_link_required` without calling identity-link or session-creation code.
6. Otherwise, execute the existing new-Google-user registration flow.

Deleted users are not reused. Existing behavior for a provider subject pointing at a deleted/missing user remains a generic invalid-Google response rather than registering or relinking it.

### Authenticated linking

1. Obtain the user ID from `request.auth`; no user ID is accepted in the body.
2. Verify the Google ID token.
3. Call the atomic link function with the authenticated user ID and verified provider values.
4. Load and return the current user with server-derived sign-in methods.

The authenticated session plus a fresh Google sign-in is sufficient. Password re-entry is deliberately not required.

## Mobile behavior

The existing Google button on sign-in and sign-up continues to use the native Google flow. When the API returns `account_link_required`, both screens show localized guidance telling the user to sign in with their password and link Google from Settings. The app does not automatically retry, create another account, or store the Google ID token.

Account Settings gains a sign-in-method section:

- While method state is unavailable, it shows a neutral loading state and no destructive or misleading action.
- If Google is absent, it shows `Link Google account`.
- If Google is present, it shows Google as connected and offers no unlink action.
- Password is displayed as available when reported by the backend.

Selecting `Link Google account` launches the existing native Google token flow, calls the authenticated link endpoint, updates the auth store from the returned user, and shows localized success feedback. The control remains disabled while the operation runs. Cancellation leaves the account unchanged and does not show a technical failure. Email mismatch and identity conflicts receive clear, safe messages. Other errors use the existing general backend-contact message and safe diagnostic logging.

This feature remains native-only wherever the current Google provider is native-only. When Google sign-in is unavailable or not configured, the link action is hidden or disabled using the same capability rules as the existing Google button.

## Security and privacy properties

- An unauthenticated verified Google email cannot claim an existing password account.
- Linking cannot target a body-supplied user or workspace.
- Linking a different email is forbidden even when both tokens are otherwise valid.
- The password hash and all current sessions remain unchanged.
- Provider ID tokens, subjects, and account emails are not added to logs or error details.
- Link conflicts do not reveal the other account or workspace.
- The client stores no additional long-lived Google credential.
- Unlinking is excluded until a separate design guarantees at least one usable recovery method.

## Testing strategy

### Backend service and route tests

- Replace the test that expects automatic email linking with a test expecting `409 account_link_required` and no identity insert or session creation.
- Preserve tests for new Google-user registration and existing-subject sign-in.
- Test the authenticated route schema, auth requirement, service call, `200` response, and rate limit.
- Test matching-email linking, same-link idempotency, email mismatch, subject owned by another user, a different Google identity already linked to the user, deleted/missing user, invalid Google token, and database failure mapping.
- Verify password registration, password sign-in, Google sign-in, refresh, invitation acceptance, and `/auth/me` return correct method arrays.
- Update and validate the generated OpenAPI document.

### Migration and database integration tests

- Assert the migration uses a guarded duplicate preflight, both uniqueness rules, row locking, explicit `search_path`, and service-role-only execution.
- Against isolated local Supabase, exercise two concurrent requests for the same user and two users competing for the same subject.
- Confirm no partial link exists after a rejected request.
- Confirm the password hash and existing sessions are byte-for-byte/logically unchanged after a successful link.
- Confirm anonymous and authenticated database roles cannot execute the function or read identity rows directly.

### Mobile tests

- Update DTO parsing and auth-store fixtures for `signInMethods`.
- Verify `account_link_required` copy on both Google entry points.
- Test Account Settings for unknown, password-only, Google-only, and combined method states.
- Test successful linking, cancellation, mismatch, conflict, generic failure, disabled/loading behavior, and auth-store refresh.
- Use the actual account/auth store interface in component tests so obsolete mocked methods cannot hide integration errors.

### Required checks

Backend:

```powershell
npm run typecheck
npm test
npm run build
npm run openapi:check
```

Mobile:

```powershell
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npm run build
```

Any unrelated baseline failures are recorded separately. New or changed files must not introduce additional diagnostics.

## Rollout and compatibility

1. Apply and validate the migration in an isolated database, then staging.
2. Deploy the backend that rejects automatic email linking and supports the explicit link endpoint and method field.
3. Verify existing password-only and Google-only accounts can still sign in.
4. Release the mobile Settings linking UI.
5. Exercise password-only → link → password sign-in → Google sign-in on a signed internal-track build.

During the gap between backend and mobile deployment, users whose Google email matches a password account receive the stable conflict and can still use password sign-in. No existing sign-in method is removed. Rolling back the mobile app leaves the backend's safer conflict behavior in place. Rolling back the backend after links have been created is data-compatible because the existing auth schema already supports identities alongside password hashes.

## Acceptance criteria

- Google sign-in never links a new provider subject to an existing account solely by matching email.
- A password-account user can link a same-email Google identity while authenticated without entering the password again.
- Password and Google sign-in both work after linking.
- Existing password hashes and sessions remain unchanged by linking.
- A different email or identity owned by another account cannot be linked.
- Repeated and concurrent link attempts create at most one Google identity and return stable outcomes.
- Backend-owned sign-in method state is shown correctly in Account Settings.
- Backend checks pass, isolated database concurrency/permission tests pass, and changed mobile code introduces no new type or build failures.
