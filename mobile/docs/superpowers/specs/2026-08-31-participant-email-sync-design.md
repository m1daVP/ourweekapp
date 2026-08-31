# Participant Email Sync for Profile Badges

## Problem

The backend returns the linked participant email for workspace owners and
accepted invitees. The frontend converts local participants into strict sync
DTOs without this server-owned field before merging them with a list response.
When timestamps are equal, the merge keeps the local DTO and loses the email.
`AppShell` consequently cannot match the authenticated user to their
participant and renders the `WU` fallback.

## Design

Keep participant email read-only and out of participant-sync writes. Add a
single frontend merge helper that retains `email` from each backend participant
after resolving the normal timestamp-based merge. Use it for initial
participant hydration and the participant-sync response, so the existing
email-based `AppShell` selection reliably renders the participant’s configured
initials and avatar color.

No backend, database, or API-contract change is required.

## Verification

Add a sync-service regression test where the local and remote participant
timestamps are equal and only the remote DTO has `email`; the stored
participant must retain that email. Keep the AppShell test asserting that the
email-matched participant badge is rendered.

## Self-review

The email remains server-owned: it is read from backend responses but never
sent in sync request DTOs. The helper affects only participant hydration and
sync response handling, leaving generic merge behavior unchanged.
