# Meeting record editing

## Goal

Let people correct or remove every record they add during an unfinished weekly meeting without leaving the guided meeting flow.

## Scope

The three meeting record types are notes, tasks, and agreements.

- Each record shows Edit and Delete controls while its meeting is unfinished and the current role has the existing relevant edit permission.
- Edit opens a mobile bottom sheet. Notes continue to use their existing bottom sheet; tasks and agreements receive equivalent focused editors.
- Task edits cover title, optional detail, responsibility, and due date. Agreement edits cover the agreement text and included participants.
- Deletes continue to use the existing undo toast pattern. Agreements gain a matching reversible delete operation.
- Completed meetings remain read-only.

## Data flow

Meeting-store update and delete actions validate that the active meeting exists, is not completed, and still contains the target record. They persist the meeting and keep the linked task/agreement record in the tasks store aligned with the edit or deletion. The session composable owns editor state, permission feedback, and undo snapshots. `MeetingPage` wires the sheets and events; `MeetingSectionStep` and the closing review show the appropriate controls.

## Error handling and accessibility

Editors reuse existing validation messages and show errors in the sheet. Buttons have record-specific accessible labels. Closing a sheet discards unsaved form state; save updates the list immediately. Delete is reversible through the snackbar action.

## Verification

Add focused store and component tests for task and agreement updates/deletes, including linked-record synchronization, plus session/page wiring tests. Run the project build and quality checks.
