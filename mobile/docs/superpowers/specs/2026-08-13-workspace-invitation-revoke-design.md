# Workspace invitation revoke design

## Goal

Allow a workspace owner to revoke a participant’s pending app invitation from the existing participant editor. Revocation must require confirmation, use the backend invitation ID, and immediately remove the pending invitation from frontend state after a successful `204 No Content` response.

## Considered approaches

### Inline revoke action with confirmation

Show **Revoke invitation** beside the pending invitation details in the participant editor, then require a destructive confirmation sheet. This is the approved approach because the invitation context and email are already visible there, and confirmation prevents accidental revocation on mobile.

### Separate invitation-management screen

A dedicated screen would support larger invitation-management workflows, but it would restore navigation and management complexity that the current participant-centered settings design intentionally removed.

### Immediate revoke without confirmation

This requires fewer taps but is unsafe for a destructive remote action and inconsistent with the app’s existing confirmation pattern.

## API contract

Add this API wrapper:

```ts
revokeWorkspaceInvitation(invitationId: string): Promise<void>
```

It sends:

```http
DELETE /workspace/invitations/:invitationId
Authorization: Bearer <accessToken>
```

The existing HTTP client supplies the authorization header through `requiresAuth: true`. A successful `204 No Content` resolves without a response body.

Expected errors:

- `401`: the user is not signed in;
- `403`: the user is not the workspace owner;
- `404`: the invitation is missing, is no longer pending, or belongs to another workspace; and
- `422`: the invitation ID is invalid.

The invitation ID is interpolated as a single encoded path segment.

## Store interface and lookup

Add a store action:

```ts
revokeParticipantInvitation(participantId: string): Promise<boolean>
```

The action resolves the pending invitation through the existing participant link:

1. normalize the participant ID;
2. find `participantInvitationLinks[participantId]`;
3. find a `workspace.invitations` record with `status: pending` whose invitation ID matches the link’s `invitationId` or whose normalized email matches the link email; and
4. refuse the request locally if no pending invitation can be resolved.

Matching by invitation ID is preferred. Email fallback supports older stored links that contain an email but no invitation ID.

The store exposes the resolved pending invitation to the UI through:

```ts
getParticipantPendingInvitation(participantId: string): WorkspaceInvitation | null
```

This keeps invitation lookup and normalization out of the Vue component.

## Successful revocation

While the request is active, `workspaceStore.isSaving` is true and repeat submission is disabled.

After `204`:

- remove the invitation from `workspace.invitations` by invitation ID;
- remove the participant’s entry from `participantInvitationLinks`;
- update the workspace timestamp and last-synced timestamp;
- persist the workspace and links together;
- return `true`; and
- leave the participant profile itself unchanged.

The participant editor then changes from **Invitation pending** to **Give app access**, closes the confirmation sheet, and shows a calm success message.

## Error behavior

### 404 reconciliation

A `404` means the local pending record is stale or no longer actionable. The store calls `loadWorkspace()` to fetch the authoritative workspace response and run normal invitation-link reconciliation.

If refresh succeeds, the revoke action returns `false` with a specific calm message explaining that the invitation is no longer pending. The bottom sheet returns to its participant edit view because the stale invitation is no longer actionable, and the participant editor reflects the refreshed state.

If refresh also fails, retain the existing local state and show the workspace load error so the user can retry later.

### Other errors

For `401`, `403`, `422`, network errors, and unexpected server errors:

- do not remove the invitation or participant link;
- keep the revoke confirmation view open;
- re-enable its actions;
- display a calm error inside the confirmation flow; and
- allow retry or cancel.

Raw server error details are not displayed.

## Participant editor interaction

The existing pending-access block continues to show the invitation email. When all conditions are true, it additionally shows **Revoke invitation**:

- the participant is not the current user;
- the participant is an adult;
- the participant access state is `pending`;
- `getParticipantPendingInvitation(participant.id)` returns a pending invitation; and
- the current role has `inviteMembers` permission.

Selecting the action switches the existing participant bottom sheet to a dedicated revoke-confirmation view with:

- title: **Revoke invitation?**;
- message including the pending invitation email and explaining that the email will no longer provide access through this invitation;
- cancel label: **Keep invitation**; and
- destructive confirm label: **Revoke invitation**.

This reuses the same `BaseBottomSheet` instead of stacking a second modal. Cancel and Android back return to the participant edit view. While deletion is active, the sheet cannot close or return to editing.

After successful revocation, the bottom sheet returns to the participant edit view so the user can see **Give app access** immediately.

## Localization and tone

Add English, Ukrainian, and Spanish strings for:

- revoke action;
- confirmation title and message;
- keep-invitation cancel action;
- revoking loading state;
- success message;
- no-longer-pending message; and
- generic revoke failure.

Copy remains calm and factual. It does not imply that the person did anything wrong.

## Accessibility

- The revoke trigger and dialog actions are semantic buttons.
- The confirmation view remains inside the existing focus-trapped participant bottom sheet.
- Loading disables close and action controls to prevent duplicate requests.
- Destructive meaning is communicated through both text and styling.
- Error text uses an alert/status mechanism that is available to assistive technology.

## Testing

Focused tests will cover:

- the API wrapper sends the encoded invitation ID using `DELETE` and authenticated access;
- pending-invitation lookup prefers invitation ID and falls back to normalized email;
- a successful revoke removes the invitation and participant link, persists, and returns `true`;
- unrelated invitations and links remain unchanged;
- a missing local pending invitation does not call the API;
- a `404` triggers authoritative workspace reload and reconciliation;
- other failures retain local state and expose a calm error;
- repeat actions are disabled while saving; and
- the revoke control is available only for a linked pending adult when the current role can invite members.

Verification includes focused tests, the complete test suite, the production build, ESLint and Prettier on changed files, and a final Git whitespace audit.

## Out of scope

- Recovering participant links that were lost before the invitation-rehydration fix.
- Revoking invitations without a linked participant.
- A standalone pending-invitations page.
- Resending invitations.
- Editing an invitation email.
- Revoking active member access; member removal remains a separate operation.
