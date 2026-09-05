# Task responsibility alignment

## Goal

Make task responsibility consistent between the meeting flow and the Tasks page by using the existing single responsibility choice only.

## Scope

- Keep the task responsibility model already used in the meeting flow: needs discussion, shared, or one participant.
- Remove the separate multi-select adult-assignment field from the Tasks page's add-task and edit-task sheets.
- When a task is created or edited from the Tasks page, do not send `responsibleUserIds` in the update payload.
- Leave any previously stored `responsibleUserIds` intact for compatibility. They will no longer be displayed or changed by the Tasks page.

## Implementation boundaries

The change updates `src/pages/TasksPage.vue`, its focused tests, and the task/meeting store update behavior required to preserve legacy assignments. Task domain types, persistence migrations, meeting flow behavior, sync DTOs, and historical task data are out of scope.

## User experience

Both Tasks sheets will contain the same responsibility control already familiar from the meeting flow:

- Needs discussion
- Shared
- A single household participant

The confusing adult multi-select will not appear. Existing task cards and responsibility labels remain unchanged.

## Data flow

Tasks-page drafts will store only title, due date, and the selected responsibility choice. Add and save actions will map that choice to `responsibilityType` and `responsibleParticipantIds`, then update the task and linked meeting task as they do today. Store updates preserve existing `responsibleUserIds` when that optional field is omitted, so no Tasks-page action overwrites legacy adult assignments.

## Verification

- Add a task from the Tasks page and verify that no adult-assignment control is shown.
- Edit a task and verify the same.
- Verify add/edit still save the selected responsibility and due date.
- Verify a task linked to a meeting stays synchronized after an edit.
- Run the focused tests, `npm run build`, and `npm run check`.
