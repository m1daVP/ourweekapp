# Owner-only household-name changes

## Goal

Only workspace owners may see, open, or save the household-name editor. Adult
members and viewers must not trigger a local or API workspace-name update.

## Frontend behavior

`HouseholdMembersSettings` will reuse its existing owner-only
`canManageHouseholdParticipants` capability to conditionally render the edit
button and guard opening and saving the name sheet. The workspace store will
also check its existing `manageWorkspace` permission before calling
`updateWorkspace`.

## Backend behavior

No backend change is necessary: `WorkspaceService.updateWorkspace` already
requires an owner through `requireManageWorkspace`.

## Testing

The household-settings component test will verify that the edit button is
hidden for adult members and viewers. A workspace-store regression test will
verify that a non-owner does not call the workspace update API wrapper.
