# Participant Email Access Design

## Goal

Make a participant's email and app access a backend-owned association. A newly
registered owner is linked to their initial participant immediately. Inviting a
participant links the participant to the invited email immediately and grants
the workspace role derived from that participant's type.

## Scope

- Each active participant may have one email, and each normalized email may
  belong to only one active participant in a workspace.
- Password and Google signup link the initial owner participant to the new
  user's email and ID.
- Registration started from a valid invitation joins the invited workspace
  rather than creating a separate personal workspace.
- Invitations target a specific participant and store that association at
  creation time.
- Invitations are delivered through the existing SMTP mailer and accepted by
  the invited account through the mobile app.
- Participant type determines invitation access role:
  - `adult` maps to `adult_member`.
  - `child` and `other` map to `viewer`.
- Participant identity is server-owned and is not changed through the
  client-driven participant sync payload.

## Non-goals

- Do not infer or backfill email associations for existing participants from
  names or local storage.
- Do not expose participant user IDs to clients.
- Do not let clients choose invitation roles or change authorization by
  changing a participant type in a sync request.
- Do not change existing permissions for owners or adult members.
- Do not make the Astro handoff page an authorization authority; it only
  forwards an invitation token to the mobile app.

## Data Model

Add nullable server-owned fields to `participants`:

- `email text`
- `email_normalized text`
- `user_id uuid references users(id) on delete set null`

Add `participant_id uuid` to `workspace_invitations`, scoped by a composite
foreign key to the invitation workspace and participant. New participant
invitations require this value.

Add partial unique indexes that enforce one normalized email per active,
non-deleted participant within a workspace. The database constraint is the
final protection; services also return stable conflict responses before a raw
constraint error reaches the client.

The migration is additive and nullable. Existing participant rows remain
unlinked; the implementation never guesses associations from names.

## Registration Flow

1. Create the user, workspace, and owner membership as today.
2. Create the initial owner participant with the signup display name, the
   account email, its normalized form, and the new user ID.
3. Create the initial partner participant without an email or user ID.
4. Create the session.

The existing registration cleanup covers participant rows through workspace
cascade deletion when registration cannot finish.

## Invitation-Aware Registration

The mobile app retains an invitation token received through the deep link. If a
recipient creates an account from that flow, password and Google registration
submit the token with the signup request. The backend validates the invitation
and exact normalized email before creating the user, then creates an active
membership in the invitation workspace using the invitation's stored role,
links the invitation participant to the user ID, consumes the invitation, and
returns a session scoped to that workspace.

Invitation-aware registration does not create a personal workspace or the
initial owner/partner participant pair. Normal registration without an
invitation retains the owner-participant bootstrap flow.

An existing account signs in normally and then accepts its pending invitation;
acceptance returns a session scoped to the invited workspace so the app does
not retain a stale workspace access token.

## Invitation Flow

1. Household settings sends `participantId` and email to the workspace
   invitation endpoint.
2. The backend authorizes the caller, loads the participant within the caller's
   workspace, normalizes the email, and derives the role from its type.
3. The backend rejects an email already linked to another active participant.
4. If the email already belongs to an active workspace member, it binds that
   member's user ID to the participant rather than creating another invitation.
5. Otherwise it atomically writes the participant's email association and a
   pending invitation with the same participant ID and derived role.
6. The backend generates a cryptographically random, single-use token. It
   stores only the token hash and sends the raw token in an SMTP email link to
   the configured Astro handoff URL.
7. The Astro page forwards the token to the mobile app with an app/universal
   link. It does not validate, log, or consume the token.
8. After sign-in or sign-up, the mobile app calls an authenticated
   invitation-acceptance endpoint. The backend verifies the token, recipient
   email, pending status, expiration, and workspace scope; creates or activates
   the membership using the stored role; attaches the accepting user ID to the
   participant; and consumes the invitation.

Revoking a pending invitation clears only the email and user association that
was created for that invitation. It never removes an active membership or an
unrelated participant association.

If SMTP delivery fails, the email association and invitation remain pending but
the API reports delivery state `failed`; it must not claim that an email was
sent. Authorized managers can resend an invitation. Resend rotates the stored
token hash and sends a fresh link, invalidating earlier links.

## Authorization

Workspace authorization continues to use `workspace_members.role`:

- Signup owner: `owner`.
- Invited adult participant: `adult_member`.
- Invited child or other participant: `viewer`.

The participant record identifies which person a workspace member represents;
it does not replace the workspace membership authorization check. Existing
minimum-role guards therefore continue to restrict viewers from adult-only
operations.

## API and Client Contract

Extend `POST /v1/workspace/invitations` with a required `participantId` for
participant invitations. The backend ignores any client-supplied role and
derives it from the stored participant type. The creation response includes
safe delivery state. Add an authorized invitation-resend endpoint and an
authenticated invitation-acceptance endpoint.

Add a required production `INVITATION_HANDOFF_URL` environment setting that
points to the Astro handoff page. It is used only to compose the email link.

Participant list and sync responses expose the email and a safe access status
needed by household managers, but never `userId`. Participant sync requests do
not accept email, normalized email, user ID, or invitation linkage fields.

Remove the frontend's persisted `participantInvitationLinks` map. The frontend
uses server-provided participant association and invitation status after every
workspace refresh, so access state survives reinstall and a new device.

## Errors

- `409 participant_email_already_linked`: an active participant already uses
  the normalized email.
- `409 workspace_member_already_linked`: an active workspace member is already
  associated with a different participant.
- `404 participant_not_found`: the requested participant is absent from the
  caller's workspace.
- `422 participant_email_required`: an invitation needs a valid email.
- `422 invitation_invalid_or_expired`: an invitation token is invalid, consumed,
  revoked, or expired.
- `403 invitation_email_mismatch`: the signed-in account does not own the
  invited email.
- `503 invitation_delivery_failed`: the invitation was stored but SMTP delivery
  did not complete; the response includes safe retry information.

All database constraint errors are mapped to these stable public errors. Raw
email values, token hashes, and user IDs are not logged.

## Tests

- Password and Google signup link the owner participant to the new user email
  and ID.
- Password and Google invitation-aware registration create no personal
  workspace or bootstrap participants, and return the invited workspace session.
- Adult, child, and other invitations bind the selected participant immediately
  and produce `adult_member` or `viewer` as specified.
- Duplicate participant emails and cross-workspace participant IDs are rejected.
- Existing matching workspace members bind to the participant without another
  invitation.
- Acceptance and revocation affect only the linked participant association.
- Invitation mail contains the Astro handoff URL and raw token, while database
  rows retain only token hashes; SMTP failure reports failed delivery and resend
  rotates the token.
- Viewer access remains restricted by existing role checks.
- Public DTOs omit participant user IDs; participant sync cannot change identity
  fields.
- The frontend displays server-backed pending/active access after refresh and on
  another device.
