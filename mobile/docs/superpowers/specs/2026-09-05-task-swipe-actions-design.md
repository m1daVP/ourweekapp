# Task swipe actions

## Goal

Add clear, mobile-friendly swipe actions to task cards without making normal scrolling, tapping, or keyboard use less reliable.

## Interaction

- Open tasks support a left-to-right swipe. A green underlay with a Finish label appears on the left. Releasing once the drag reaches 25% of the card width applies the existing completion action.
- All task statuses support a right-to-left swipe. A red underlay with a Remove label appears on the right. Releasing at 25% of the card width opens the existing deletion confirmation; deletion is never applied by the gesture alone.
- Swipe direction determines which underlay is visible. The moving card reveals the corresponding underlay while the user drags.
- A gesture begins only after clear horizontal intent. Vertical movement continues scrolling and a short movement remains a normal card tap.
- Once a swipe occurs, the following click is suppressed so a card editor does not open accidentally.
- Completed tasks do not offer the finish swipe. Their current status control remains available.

## Architecture

Create a focused task feature component that owns pointer gesture state, width measurement, translated card position, threshold evaluation, and click suppression. It receives card content and task state through typed props and emits `open`, `finish`, and `requestDelete` events.

`TasksPage.vue` will replace its duplicated shared and personal task-card markup with the component. The page retains task-store operations, completion animation, deletion confirmation, permissions, and task grouping.

The existing meeting-history swipe helper is delete-only and uses a 50% threshold. This task component will use a dedicated bidirectional helper with a 25% threshold rather than changing meeting-history behavior.

## Accessibility and motion

- Keep semantic buttons for the existing complete and open actions.
- Provide a visible, focusable Remove button outside the gesture path, invoking the same confirmation event.
- Underlays are decorative state feedback and are hidden from assistive technology.
- Use transform and opacity transitions only, and disable motion under reduced-motion preferences.

## Error handling

The component does not mutate task data. If the parent denies a finish or delete action because of permissions or state, the parent continues to show its existing feedback. Pointer cancellation, width measurement failure, and vertical gestures reset the card without an action.

## Verification

- Unit-test the 25% bidirectional threshold, horizontal-intent detection, clamping, and click suppression.
- Component-test the action events: finish only for open tasks and deletion request for all tasks.
- Manually verify drag feedback, vertical scrolling, opening by tap, completion, and deletion confirmation on a touch device or emulation.
- Run focused tests, `npm run build`, and `npm run check`.
