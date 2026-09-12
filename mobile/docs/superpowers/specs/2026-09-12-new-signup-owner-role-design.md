# New Signup Owner Role Design

## Goal

A person who creates an account without an invitation can start using OurWeek
immediately as the owner of their new household. Invited users retain the role
assigned to their invitation.

## Context

The API already creates a workspace and an active `owner` membership for a
non-invitation registration, then returns that role in the authentication
session. On the client, a fresh authenticated session resets local workspace
state before asynchronous core-data hydration completes. The workspace store
labels that unsynced state as `viewer`, so the Meeting screen renders its
read-only state before the server workspace is loaded.

## Design

The frontend will preserve the role returned in the authenticated session.
While the workspace store has not loaded its server data for that session, its
permission getter will use that authenticated role. Once workspace hydration
completes, the workspace membership remains the source for the effective role.

This fallback is limited to the unsynced local placeholder state. It must not
replace server-synced membership roles and must not promote invited users.

## Error Handling

If workspace loading fails, the client still honors the backend-authenticated
role for the current session; backend authorization remains the authority for
all remote writes. A later sync retry can replace the placeholder with the
server workspace.

## Testing

Add focused frontend regression coverage that proves a fresh owner session can
create a meeting before hydration, and that an invited viewer remains unable to
create one. Existing backend registration tests already cover creating an owner
membership and require no contract or migration change.

## Scope

No API endpoints, database migrations, role definitions, or invitation
semantics change. The work is limited to frontend authentication/workspace
state and its tests.
