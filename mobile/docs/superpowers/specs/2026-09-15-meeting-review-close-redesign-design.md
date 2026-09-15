# Meeting review-and-finish redesign

## Scope

Redesign only the final, in-progress meeting review screen rendered by
`src/features/meeting/components/MeetingReviewCloseStep.vue`. Do not change the
completed meeting summary page, its data model, or its behavior.

## Visual direction

Preserve the existing screen header and the page's horizontal padding. The
review content will adopt the supplied mobile references: a spacious completion
hero, independent off-white cards with thin warm borders, dark forest-green
type and controls, and restrained sand-colored status pills.

Typography inside the page will become more deliberate without changing the
header: serif display styling for the hero and card titles, readable sans-serif
body copy, small muted metadata, and compact action labels. All sizing remains
responsive for narrow Android screens.

## Layout and components

The existing `MeetingReviewCloseStep` remains the state and event owner.

- The confirmation hero remains at the top and is visually updated to match the
  reference's centered completion state.
- Tasks, agreements, and notes remain separate review cards. Each card has an
  icon, title, saved-count pill, and an inset content area where appropriate.
- Task rows retain completion, edit, and delete interactions, but become
  rounded inset cards with clearer assignment metadata and quiet icon actions.
- Agreement and note rows receive the same inset-card treatment and retain
  their current edit/delete actions and permission states.
- The notes control retains the existing `MeetingDisclosurePanel` component.
  Its trigger is styled as the wide, rounded inline dropdown shown in the
  reference, preserving its accessible show/hide behavior.
- The quick-add panel and final actions become visually distinct rounded areas
  with pill-shaped controls, while retaining their existing actions and disabled
  states.

No element will be made full-width beyond the page's existing content area.

## Behavior and accessibility

The redesign will not change meeting data, saving, edit/delete events,
permissions, translations, notes visibility behavior, or the finish-meeting
flow. Existing semantic buttons, labels, disabled states, focus styles, and
bottom-sheet behavior remain in use. Touch targets for icon actions and primary
controls remain at least 44 pixels.

## Verification

Update only focused component tests if markup-level assertions require it. Run
the relevant review-step tests, then `npm run build` and `npm run check` after
implementation. Manually verify the step at narrow mobile widths, including the
notes picker, task/agreement/note edit and delete controls, quick-add actions,
and the final finish action.
