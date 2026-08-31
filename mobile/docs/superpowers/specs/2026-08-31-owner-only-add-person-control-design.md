# Owner-only add-person control

## Goal

Only a workspace owner may start or complete the household “Add person” flow.
Adult members and viewers must not see the control or be able to create a
participant through stale UI state or a direct component action call.

## Frontend behavior

`HouseholdMembersSettings` will use the existing owner-only `manageWorkspace`
permission to conditionally render the “Add person” button. The
`openCreateSheet` and create branch of `saveParticipantDraft` will also return
without changing participant state when that permission is absent.

This shares the existing permission model without changing meeting guest
participants, invitation delivery, backend routes, or participant editing.

## Testing

A focused component test will verify that the button is visible to an owner and
absent for an adult member. A direct-action regression test will verify that a
non-owner cannot cause the participant store's create operation to run.

## Risk

This narrows household-participant creation to owners. Existing non-owner
access to meetings and other permitted actions is unchanged.
