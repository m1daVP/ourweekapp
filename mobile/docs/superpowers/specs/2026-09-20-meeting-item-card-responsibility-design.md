# In-meeting task responsibility label

## Goal

Show the resolved responsibility label on task cards during the active meeting, matching the information shown in the close-review step.

## Design

`MeetingSectionStep` already passes enriched task objects to `MeetingItemCard`. Those objects include `responsibilityLabel`, resolved by `useMeetingSession` from the task's responsibility type and assigned participant IDs.

`MeetingItemCard` will accept task-shaped items with an optional `responsibilityLabel` field. This keeps the component compatible with plain `MeetingTask` values and avoids importing its parent composable's enriched type.

For task cards, the component will render the responsibility label as secondary metadata before the existing due-date metadata. If a caller supplies a plain task without a label, no empty responsibility element will be rendered.

## Verification

Extend the component test to mount an enriched task, assert its responsibility label is visible, and retain existing action-menu coverage. Run the focused test, then the project's build and checks.
