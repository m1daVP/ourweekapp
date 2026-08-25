# Hidden participant restore design

## Problem

Choosing “Hide from new meetings” sets a participant to inactive. The Household members list currently reads only active participants, so the hidden participant disappears. Although the edit sheet already contains a “Show in new meetings” action for inactive participants, there is no way to reopen that sheet from the UI.

## Considered approaches

1. Keep active and hidden participants in the same list, and label hidden rows. This is the recommended and approved approach because restoration stays discoverable without adding another navigation path.
2. Put hidden participants in a separate collapsed section. This creates clearer grouping but adds UI and makes restoration less discoverable.
3. Show only a temporary Undo snackbar after hiding. This is useful for immediate mistakes but does not support restoration later.

## Approved behavior

- Household members lists every non-deleted participant, including inactive participants.
- Active participants remain first. Hidden participants follow them while preserving their existing relative order.
- An inactive row shows the existing “Hidden from new meetings” text visibly, not only to screen readers.
- Tapping a hidden participant opens the existing edit sheet.
- The edit sheet shows “Show in new meetings” for an inactive participant.
- Restoring a participant marks them active, updates the active meeting participant snapshot through the existing synchronization call, shows the existing success message, and closes the sheet.
- Past meetings and existing references remain unchanged.
- Hidden participants remain excluded from new-meeting participant selection until restored.

## Code boundaries

- Add a participant-store getter that returns all non-deleted participants for management UI, ordered with active participants before inactive participants.
- Keep `activeParticipants` unchanged because meeting flows rely on it to exclude hidden people.
- Update `HouseholdMembersSettings.vue` to render the management getter and expose the hidden-state label.
- Reuse `enableParticipant`; no new persistence shape or migration is needed.

## Accessibility and presentation

- The hidden state is written as text so color is not the only indicator.
- Rows remain semantic buttons with the current edit label and touch target.
- The restore action remains a semantic button in the bottom sheet.

## Testing

- Store tests verify the management list includes inactive participants, excludes deleted participants, and orders active participants first.
- Existing participant-store behavior verifies that restoring sets `isActive` and persists the change.
- Focused tests, the full test suite, the production build, and relevant lint/format checks run before handoff.

## Out of scope

- A temporary snackbar or one-tap Undo action.
- A separate archived-members screen.
- Changes to past meetings or participant deletion behavior.
