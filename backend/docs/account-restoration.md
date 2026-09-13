# Restore a deleted account

The project owner can restore a soft-deleted account from a trusted backend checkout. This is an operator action, not a public API: confirm that the support request controls the email address before proceeding.

## Prerequisites

- Deploy `20260912120000_create_account_restore_rpc.sql` first.
- Load the target environment's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into the shell. Never paste the service-role key into a client, ticket, or chat.

## Command

```powershell
npm run account:restore -- --email person@example.com
```

If the command says restoration is not deployed, apply the migration through the normal deployment process (for example, `npm run db:migrate` against the intended Supabase project) before retrying. Do not run the command against production until that deployment is complete.

The command restores the deleted user and reports only the number of restored workspaces and memberships. It restores a workspace that was soft-deleted when the user was its sole owner. If ownership was transferred during deletion, it restores the user as an adult member and does not change the current owner.

Restoration does not recreate sessions, refresh tokens, Google Calendar credentials, or provider tokens. Ask the user to sign in again and reconnect Google Calendar if they used it.
