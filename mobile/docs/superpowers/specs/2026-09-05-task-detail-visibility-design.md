# Task detail visibility

## Goal

Make a task's supporting description easy to notice and read in the task edit sheet without adding an editing flow or visual clutter.

## Interaction and hierarchy

- When a selected task has a description, display it in a dedicated Details block after the due-date field.
- The Details label matches the form's existing field labels exactly.
- The description sits directly beneath that label, using the improved readable text size and comfortable line height without a card background or accent border.
- The description remains read-only in this change.
- The linked-meeting line stays below the Details block as secondary metadata, using its existing quieter presentation.
- Tasks without a description do not show an empty card.

## Architecture

The change is confined to the edit sheet in `src/pages/TasksPage.vue` and the corresponding global task-editor styles in `src/styles/main.css`. Use the existing `tasksPage.optionalDetail` translation as the label so no new localized copy is required.

## Accessibility and motion

- Use semantic text content with sufficient contrast; no new interactive control is introduced.
- Preserve natural reading order: title, responsibility, date, details, source meeting, actions.
- The change is static and needs no animation.

## Verification

- Add a focused Tasks page test that confirms a description renders inside the Details block and that no block appears when it is absent.
- Run the focused test, `npm run build`, and targeted ESLint.
