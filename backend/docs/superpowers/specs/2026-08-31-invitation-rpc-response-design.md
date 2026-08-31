# Invitation RPC response handling

## Problem

Creating a workspace invitation calls `create_participant_invitation`, which
returns one `workspace_invitations` composite value. The deployed database
function exists and has the expected signature. Its successful response can be
a single object, but `WorkspacesRepository.createInvitation` currently accepts
only an array. It therefore treats a successful RPC result as missing and
returns the generic `workspace_invitation_create_failed` error.

## Design

Keep the database function and API contract unchanged. Update only the
repository boundary so it accepts a single invitation object or a one-element
array, then maps that row to the existing safe DTO. A missing result remains a
safe 500 error; Supabase errors continue through the existing error mapper.

Add repository regression coverage for the single-object result, alongside the
existing array-compatible behavior. No migration, client-contract change, or
new dependency is required.

## Verification

Run the focused workspace repository tests, then TypeScript typechecking. The
test must prove that a successful object response calls the same RPC with the
same workspace-scoped arguments and returns the invitation DTO.

## Self-review

There are no placeholders, schema changes, or ambiguous behavior changes. The
change is limited to normalizing the external provider response at the existing
repository boundary.
