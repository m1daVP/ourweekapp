# Deleted Account Restoration Design

## Goal

Give users a clear response when they try to use credentials for a deleted account, while giving the project owner a safe, repeatable way to restore an account without creating a public admin API.

## Scope

- Preserve the existing soft-delete model and email uniqueness rules.
- Return a stable, non-sensitive authentication error for a deleted account: `account_deleted`, with the message `This account was deleted. To restore it, email ourweekapp@gmail.com.`
- Provide a local, operator-run restoration script and runbook.
- Do not create a session during restoration. The restored user signs in normally afterward.

## Authentication Behavior

Password sign-in must distinguish an active account, a deleted account, and an unknown account internally. Only the deleted-account branch returns `account_deleted`; unknown emails and incorrect passwords retain the existing generic invalid-credentials response.

Registration keeps its current behavior: a deleted account's email remains reserved, and an attempted registration returns `email_already_registered`. This prevents silent duplication of a user identity and preserves the account's historical relationships.

## Restoration Tool

Add a TypeScript CLI script that connects through the existing server-side Supabase configuration. It accepts one normalized email address, validates that the user exists and is soft-deleted, calls one service-role-only PostgreSQL RPC, and reports a minimal success summary. It must never print password hashes, refresh tokens, provider tokens, service-role credentials, or raw database errors.

The command is intended for the project owner on a trusted machine with the backend environment configured. It is not an HTTP endpoint and must not be exposed to clients.

## Database Restoration Rules

The restoration RPC runs transactionally and is idempotent:

1. Clear `users.deleted_at` for the selected deleted user.
2. Restore that user's removed workspace memberships where the workspace remains active.
3. For a workspace that was soft-deleted because the user was its sole owner, clear the workspace's `deleted_at` and restore the user as its owner.
4. For a workspace where ownership was transferred during deletion, restore the user as an `adult_member`; do not alter the current owner or elevate the restored user.
5. Do not restore sessions, calendar credentials, refresh tokens, or other credentials cleared by deletion.

The RPC will fail safely for an active or unknown user. It must be callable only by `service_role`.

## Operator Documentation

Document the exact `npm` command, required environment variables, expected output, and recovery implications. The runbook will state that restoration re-enables account and workspace access but cannot recover revoked sessions or cleared calendar tokens; the user must sign in again and reconnect a calendar if applicable.

## Testing

Add focused tests that prove:

- deleted accounts receive the stable support-directed sign-in error;
- invalid credentials and unknown users remain generic;
- the restoration RPC restores the sole-owner workspace case;
- the transferred-ownership case restores membership without changing the current owner;
- restoration remains idempotent and does not recreate sessions or calendar tokens;
- the RPC cannot be called by anonymous or authenticated database roles.

## Rollout and Safety

The migration is additive: it adds a new service-role-only RPC and does not modify the account-delete RPC or applied migrations. Deploy the migration before distributing the operator command. The sign-in behavior is compatible with existing mobile clients because it uses the established error response shape; clients that do not yet handle `account_deleted` will still display its safe message.
