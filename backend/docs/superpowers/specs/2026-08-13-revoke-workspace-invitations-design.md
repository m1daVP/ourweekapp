# Revoke Workspace Invitations Design

## Goal

Allow a workspace owner to revoke a pending workspace invitation through the
versioned API, alongside the existing member-removal flow.

## API Contract

Add `DELETE /v1/workspace/invitations/:invitationId`.

- Authentication is required.
- Only an active workspace owner may use the endpoint.
- `invitationId` is validated as a UUID.
- The invitation lookup and update are scoped to the authenticated owner's
  `workspaceId`.
- Only invitations with `status = 'pending'` can be revoked.
- On success, respond with `204 No Content`.
- Missing, already accepted, expired, or previously revoked invitations respond
  with the existing stable `404 workspace_invitation_not_found` error. This
  avoids revealing invitation state outside the current operation.

## Architecture

The workspace route remains thin: it authenticates the request, validates the
route parameter, calls `WorkspaceService.revokeInvitation`, and sends the 204
response. `WorkspaceService` applies the existing owner-only
`requireManageWorkspace` authorization check. The repository performs one
workspace-scoped update from `pending` to `revoked` and maps an absent affected
row to the safe 404 error.

This does not delete invitation rows. Preserving the row retains invitation
history while making it ineligible for any future acceptance flow. No database
migration is required because `revoked` is already a valid invitation status.

## Error Handling

- Unauthenticated requests return the existing `401` response.
- Non-owner authenticated members receive the existing `403 forbidden` response.
- Invalid invitation IDs are rejected by route validation with `422`.
- A pending invitation in another workspace must appear not found rather than
  being revoked.
- Supabase failures continue through the shared safe repository error mapping;
  no database details are returned to clients.

## Testing

Add focused route, service, and repository coverage for the successful revocation
path. Assert owner authorization, UUID validation, workspace scoping, pending
status filtering, 204 response behavior, and the safe not-found result when no
pending invitation is affected. Existing member removal behavior is unchanged.

## Out of Scope

- Hard-deleting invitation rows.
- Allowing adult members or viewers to revoke invitations.
- Changing active-member removal semantics.
- Adding resend, expiration, or invitation-acceptance behavior.
