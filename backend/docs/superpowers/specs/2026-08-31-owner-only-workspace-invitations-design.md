# Owner-only workspace invitations

## Goal

Only workspace owners may create an invitation, resend an invitation, or link an
existing workspace member to a participant. Adult members and viewers must not
be able to perform any of these actions.

## Backend

The workspace service's shared invitation authorization helper will require an
authenticated context with the `owner` role. The three affected service methods
will continue to use that shared helper:

- `createInvitation`
- `resendInvitation`
- `linkParticipantToExistingMember`

Unauthorized callers receive the existing stable `403 forbidden` response and
the repository is not called. No schema or API-contract changes are required.

## Frontend

The existing `inviteMembers` UI permission remains owner-only, so invitation
controls stay hidden for adult members and viewers. The workspace store will
also enforce that permission before calling create, resend, or link APIs. This
prevents non-owners from triggering these operations programmatically or from
stale UI state.

## Testing

Backend service tests will assert that an adult member cannot create, resend, or
link an invitation and that no repository operation occurs. Frontend store tests
will assert that non-owners do not call the corresponding API wrappers. Existing
eligibility tests will continue to verify that invitation controls are only
offered when the owner-only permission is present.

## Scope and risks

This is an authorization-only behavior change. It does not change invitation
data, roles assigned to invitees, database schema, email delivery, or acceptance
flows. The backend remains the authoritative enforcement point; frontend checks
provide immediate client-side protection and preserve the intended UI state.
