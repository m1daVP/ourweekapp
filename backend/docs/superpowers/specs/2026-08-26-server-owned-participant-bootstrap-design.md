# Server-Owned Participant Bootstrap Design

## Problem

The frontend participant store creates local `Me` and `Partner` records whenever
participant storage is empty. After login on a fresh browser or a reinstalled
app, those records can be created while initial cloud hydration is running.
`POST /v1/participants/sync` treats unknown active IDs as intentional creates,
so the local placeholders are inserted next to the workspace's existing,
renamed participants.

Participant initialization must instead be server-owned. Signup creates the
initial participant records, while login and reinstall only hydrate records that
already belong to the authenticated workspace.

## Required Behavior

- Password signup and first-time Google signup create the workspace, owner
  membership, an owner participant named from the signup display name, and the
  initial `Partner` participant on the backend.
- A failure to create either initial participant fails registration and invokes
  the existing partial-registration cleanup path.
- Login, token restoration, and reinstall do not create participant records.
- Before bidirectional core-data sync starts, the client reads the workspace's
  active participants from the backend.
- An authenticated client with empty local participant storage remains empty
  until backend hydration completes; pages and stores do not synthesize defaults.
- Existing local-first behavior for participants explicitly added later by a
  user remains supported by participant sync.
- Participant reads and writes remain scoped by the authenticated workspace ID.

## Backend Design

### Registration bootstrap

Both password registration and the new-user branch of Google registration add
two participant rows after the workspace and owner membership have been created:

1. The owner's validated signup display name, with initials derived from that
   name, color `#496a8f`, type `adult`, active.
2. `Partner`, initials `P`, color `#6b8f71`, type `adult`, active.

The backend generates their IDs and timestamps. The inserts are part of the
existing guarded registration sequence. If they fail, registration does not
return a session and the existing cleanup logic removes data created by that
attempt. No client-supplied participant bootstrap payload is accepted.

### Participant hydration endpoint

Add `GET /v1/participants` as an authenticated, workspace-scoped read endpoint.
It returns a stable response:

```json
{
  "participants": []
}
```

Only non-deleted participants are returned. DTO serialization continues to
exclude `workspace_id` and other internal fields. The existing sync endpoint
continues to handle subsequent local-first mutations.

## Frontend Design

The participant store no longer creates defaults in its state initializer or in
`ensureDefaultParticipants`. Authenticated pages and meeting actions stop calling
that method. Empty participant state is a valid temporary state while logged
out, during authentication, and during hydration.

Initial core-data hydration fetches workspace, participants, meetings, and tasks
before marking hydration complete or starting participant sync. Server
participants are merged into legitimate local records for the same previously
bound user, preserving offline-first edits. For a newly bound user or fresh
installation, the local participant state has already been cleared, so hydration
produces an exact server-backed participant set.

The hydrated participant list is persisted and `currentParticipantId` is selected
from the resulting records. No route transition is allowed to manufacture
placeholder participants while hydration is in flight.

## Failure Handling

- Signup participant initialization failure returns the same safe registration
  failure behavior used for other partial signup failures; raw database errors
  are not exposed.
- Participant hydration failure leaves local state unchanged, marks participant
  sync as failed, and prevents the initial hydration flag from being completed.
- A later retry repeats hydration before attempting a participant push.
- Offline startup never invents participants. Previously persisted participants
  remain usable for the same bound user; a fresh installation waits for network
  hydration.

## Duplicate Registration Feedback

When user creation fails with PostgreSQL unique-constraint code `23505`, the
registration endpoint returns `409` with code `email_already_registered` and
the message `An account with this email address already exists. Sign in
instead.` This intentionally discloses whether an email address has an account;
the existing registration rate limit remains in place to limit abuse. Other
account-creation failures remain generic `500 account_create_failed` responses.

## Existing Duplicate Data

This change prevents new duplicates but does not automatically delete existing
rows. Names such as `Me` and `Partner` can be legitimate, and automatic cleanup
could break meeting, task, or agreement references. Existing duplicate rows
should be removed separately by exact participant ID after reference impact is
checked.

## Testing

Backend tests cover:

- password signup creates both initial participants;
- first-time Google signup creates both initial participants;
- participant creation failure triggers registration cleanup and does not return
  a session;
- duplicate password registration returns the explicit `409
  email_already_registered` response;
- `GET /v1/participants` requires authentication and scopes reads to the request
  workspace;
- response DTOs do not leak workspace or database fields.

Frontend tests cover:

- an empty participant store does not generate defaults;
- fresh-browser login hydrates renamed server participants and sends no generated
  `Me` or `Partner` records;
- reinstall-equivalent storage reset behaves the same way;
- hydration failure cannot fall through to an initial participant push;
- same-owner persisted offline participant changes remain available for normal
  sync after hydration;
- meeting, tasks, templates, and household settings tolerate the temporary empty
  participant state.

## Out of Scope

- Automatic deletion or merging of already duplicated participant rows.
- Changing the broader local-first sync model for participants created after
  initialization.
- Localizing backend-owned default participant names.
- A database migration or transaction RPC for registration; the existing
  compensating cleanup approach remains in use.
