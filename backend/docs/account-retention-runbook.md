# Account Retention and Erasure Runbook

**Status:** Decision required before irreversible erasure is implemented.

## Current behavior (source-verified)

`account_delete` is a service-role-only RPC. It revokes active sessions, clears
stored Google Calendar credentials, removes the member from active households,
transfers a household to an eligible remaining adult when possible, and
soft-deletes the user or a sole-owner household. The function does **not** erase
the user record, authentication identity, shared records, provider records, or
backups.

`account_restore` is also service-role-only. It restores a soft-deleted user and
eligible memberships/workspaces, but intentionally does not restore sessions or
Calendar credentials. Consequently, a soft-deleted account is recoverable today;
it is not an erased account.

## Required lifecycle decision

Choose one approved policy before adding an erasure migration, worker, or public
retention claim:

1. **Immediate irreversible erasure:** verified deletion revokes access at once
   and starts an irreversible erasure workflow promptly, with a disclosed
   completion deadline. Restoration must be rejected after verification.
2. **Disclosed restoration grace period:** verified deletion revokes access at
   once, but restoration remains possible for an explicitly chosen period. At the
   end of that period, a durable workflow performs irreversible erasure. The
   public policy must state both the grace period and the erasure deadline.

Do not select a grace period, backup expiration, or legal-hold duration from
source code. The current public 30-day/90-day language is not backed by a
durable erasure or backup-enforcement mechanism and must not be treated as
operational evidence.

## Data inventory and proposed treatment

| Data area | Current relationship / contents | Proposed erasure treatment after approval |
| --- | --- | --- |
| `users` | Account email, normalized email, display name, password hash, soft-delete timestamp | Erase or irreversibly anonymize only after the approved eligibility point. |
| `sessions` | User refresh-token hashes and revocation state | Revoke immediately; delete expired and erased-account session rows. |
| `password_reset_tokens` | User-scoped reset token hashes | Delete at account erasure. |
| `auth_identities` | Provider subject and email linked to a user | Delete at account erasure; do not retain provider email or subject without an approved purpose. |
| `workspace_members` | Membership email/display name and role | Remove deleted member data. Preserve surviving members and their household access. |
| `workspaces`, meetings, participants, tasks, agreements, review decisions | Shared household records | If another eligible owner remains, retain shared records and transfer ownership. For a sole-owner household, erase according to the approved inventory in foreign-key-safe order. |
| `subscriptions` | Provider customer and entitlement identifiers | Retain only records required for billing/legal obligations with a stated expiry; deletion does not cancel an app-store subscription. |
| `calendar_connections`, `calendar_events`, `calendar_preferences` | Connected email, encrypted OAuth credentials, mapped Google event IDs, preferences | Revoke and remove mapped Google events before credentials become unavailable when possible; delete local credentials and identifiers at erasure. Provider failure must be recorded for retry without placing tokens in a queue payload. |
| `ai_summary_requests` and generated meeting recaps | Request metadata, generated summary output, retained shared meeting content | Erase for a sole-owner household; retain only the shared meeting content needed by surviving household members. Do not retain raw prompt content in a new erasure queue. |
| `assistant_settings`, recap-credit reservations, assistant follow-ups | User/workspace feature settings and generated follow-ups | Erase user-owned settings; retain shared records only when a surviving household has a documented need. |
| `workspace_invitations` | Invitation email and delivery metadata | Revoke and erase expired/deleted-account invitation data under an approved retention rule. |
| Background queue/dead letters | Job payload hashes and operational metadata | Never include email, raw tokens, passwords, or support notes. Define ledger and dead-letter retention before dispatching erasure jobs. |
| Supabase Auth and external providers | Auth identity, OpenAI, Google, RevenueCat, support/log providers, backups | Obtain provider and infrastructure evidence. A database migration cannot prove provider deletion, backup expiry, or restoration suppression by itself. |

## Household cases

- **Non-owner member:** revoke access, remove that member’s identity and
  membership data at erasure, and preserve shared household records for the
  remaining household.
- **Owner with an eligible successor:** preserve the shared household and
  transfer ownership atomically before erasing the departing owner’s identity.
- **Sole owner without successor:** retain no household merely because the user
  row is soft-deleted; erase the household in the approved safe foreign-key
  order once the lifecycle permits it.

## Operational evidence required before release

1. A count-only dry run of already soft-deleted accounts, with no bulk purge.
2. The deployed worker/scheduler path, retries, dead letters, and monitoring for
   oldest outstanding erasure requests.
3. Backup/PITR, snapshot, export, and restore configuration, including the event
   that starts each retention period and a restore drill that reapplies deletion
   records before traffic resumes.
4. Documented support verification for email deletion requests. Do not request
   passwords, access tokens, or refresh tokens in a support message.
5. Staging migration, recovery plan, database review, and confirmation that the
   migration runs before code requiring the new lifecycle.

## Explicitly not completed

No production data was inspected or changed. No erasure migration, scanner,
worker handler, provider-cleanup ledger, bulk purge, backup configuration
change, or public retention-language update has been made from this runbook.
