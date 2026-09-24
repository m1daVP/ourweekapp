# Meeting Permissions and Composer Repair Design

## Goal

Repair the meeting experience after the latest redesign so that only viewers
receive read-only access, and item-composer controls follow the existing
OurWeek mobile design system.

## Scope

This repair covers the meeting route decision, the temporary authenticated
workspace role used before hydration, and the add-item bottom sheet. It does
not change workspace roles, invitation rules, backend authorization, meeting
data, or the meeting flow itself.

## Permission behaviour

- `owner` and `adult_member` can create, resume, and edit meetings.
- `viewer` alone receives the read-only meeting state when there is no active
  meeting. Viewers remain unable to create or edit meetings.
- Before workspace hydration finishes, the workspace store uses the role from
  the authenticated session. Once the server workspace is present, its current
  membership remains the effective role.
- A failed workspace load continues to use the authenticated role locally;
  backend authorization remains the authority for remote writes.

## Composer design

The add note, task, and agreement sheet retains its existing saving and draft
behaviour. Its task responsibility and due-date fields use the project’s
existing mobile picker components rather than native controls. Fields use the
shared input styling, and the footer uses a clear full-width primary save
action with a secondary cancel action, adequate touch targets, and the
existing bottom-sheet spacing and error treatment.

## Testing

Regression coverage will prove that a pre-hydration owner and adult member can
reach the normal meeting flow, while a viewer is routed to read-only access.
Composer tests will verify that responsibility and date input use shared
mobile picker components and that the primary and secondary action classes are
present. Existing viewer restrictions must continue to pass.

## Acceptance criteria

1. Owners and adult members never see the viewer-only message solely because
   the workspace has not hydrated or no meeting is active.
2. Viewers continue to see read-only access and cannot start or edit a
   meeting.
3. The composer exposes no unstyled native select or date field.
4. The composer’s form fields and actions visually match existing OurWeek
   bottom sheets on a mobile viewport.
5. Type checking, linting, formatting checks, and targeted tests pass.
