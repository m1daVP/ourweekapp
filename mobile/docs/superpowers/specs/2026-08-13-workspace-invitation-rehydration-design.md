# Workspace invitation rehydration design

## Problem

The backend `GET /workspace` response contains both `members` and `invitations`. The frontend currently aliases `WorkspaceDto` to the `Workspace` domain type, which has no `invitations` field. Workspace refresh therefore replaces the locally projected invited member with the backend member list and discards participant invitation links whose emails are absent from `members`.

This affects both pull-to-refresh and app restart because startup loads the persisted state and then refreshes `/workspace`. The invitation was created successfully and its email was initially persisted, but the subsequent reconciliation incorrectly treats it as stale.

## Approved source of truth

The `/workspace` response is authoritative for workspace members and invitation lifecycle state. The frontend retains only the participant-to-email association locally because backend invitations do not contain a participant ID.

An association remains valid when its normalized email matches either:

- a non-removed workspace member; or
- a workspace invitation whose status is `pending`.

An association is removed when its email matches neither source. Invitations with `accepted`, `revoked`, or `expired` status do not independently keep an association alive. An accepted invitation is expected to be represented by the matching active member returned by the workspace endpoint.

## Domain and API contract

Introduce a shared `WorkspaceInvitation` type with:

- `invitationId`;
- `email`;
- optional `displayName`;
- `role`, excluding `owner`;
- `status`: `pending`, `accepted`, `revoked`, or `expired`;
- `createdAt`; and
- `expiresAt`.

Add `invitations: WorkspaceInvitation[]` to `Workspace`. `WorkspaceDto` continues to represent the API response but now includes the complete workspace shape rather than silently omitting invitations. The POST invitation response uses the same invitation type.

## Normalization and storage migration

Workspace normalization will validate invitations independently from members:

- require a non-empty invitation ID and email;
- normalize email with trimming and case folding;
- preserve a trimmed optional display name;
- accept only non-owner roles supported by the invitation contract;
- accept only the four known invitation statuses;
- require non-empty creation and expiration timestamps; and
- discard malformed invitation records without breaking workspace loading.

Increment workspace storage from version two to version three. Version-two workspace data has no `invitations` field, so missing invitations migrate to an empty array. No user data is deleted during this migration, and the existing participant invitation links remain available for reconciliation against the next backend refresh.

Default and authenticated-placeholder workspaces initialize with an empty invitations array.

## Store behavior

### Applying a workspace response

`applyWorkspace` will:

1. normalize the complete workspace, including invitations;
2. collect normalized emails from non-removed members and pending invitations;
3. retain participant invitation links whose email exists in that combined set;
4. remove links that match neither set;
5. keep the existing current-user fallback behavior; and
6. persist the normalized workspace and reconciled links.

This ensures the same behavior after pull-to-refresh and app restart.

### Sending an invitation

After `createWorkspaceInvitation` succeeds, the store will add or replace the returned invitation in `workspace.invitations` by `invitationId`. It will no longer create a synthetic `WorkspaceMember` with `status: invited`.

The participant invitation link continues to store the normalized participant ID, email, and invitation ID. The workspace and link are persisted together after the successful response.

### Deriving participant access

`getParticipantAccessState(participantId)` will resolve a link in this order:

1. If a non-removed member has the same normalized email, return `active` for an active member and `pending` for any existing non-active member state.
2. Otherwise, if a pending invitation has the same normalized email, return `pending` with that email.
3. Otherwise, return `none`.

The settings UI requires no structural change because it already renders the result of this getter.

## Edge cases

- Multiple invitations may have the same display name. Matching is by normalized email, not display name.
- Email comparison is case-insensitive and ignores surrounding whitespace.
- A pending invitation returned after app restart restores its status when the local participant link still exists.
- If an invitation is accepted and a member with the same email is returned, access becomes active without changing the local participant link.
- Revoked and expired invitations do not show as pending.
- Malformed invitation records are ignored while valid members and invitations continue loading.
- The frontend cannot reconstruct a participant association after local application data is deliberately cleared because the backend invitation has no participant ID. That case is outside this fix.

## Testing

Focused tests will cover:

- workspace normalization retains valid backend invitations;
- missing invitations migrate to an empty array;
- POST invitation success stores a real invitation rather than a synthetic member;
- persisted invitation data survives fresh Pinia-store creation;
- `applyWorkspace` retains a participant link matched by a pending invitation;
- a matching active member transitions access to active;
- expired, revoked, and missing invitation emails remove stale links;
- invitation and member email matching is normalized; and
- malformed invitations are discarded safely.

Verification will include focused workspace-store tests, API/type checks through the production build, the full test suite, ESLint and Prettier on changed files, and a final whitespace audit.

## Out of scope

- Changing the backend invitation payload or endpoint.
- Adding participant IDs to backend invitations.
- Reconstructing associations after intentional local-data deletion.
- Invitation resend, revoke, or delete controls.
- Restoring the removed standalone workspace-members page.
