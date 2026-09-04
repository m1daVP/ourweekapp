# Bottom-sheet height cap

## Goal

Prevent shared bottom-sheet drawers from expanding to the top of a mobile screen.

## Decision

Apply a `50dvh` maximum height to the shared `.base-bottom-sheet__panel` style in `src/styles/main.css`.

## Behavior

- The sheet remains anchored to the bottom edge.
- Its visible panel height cannot exceed half of the dynamic viewport height.
- Content that exceeds the cap scrolls within the panel.
- The existing header, close control, backdrop, focus trap, Android-back behavior, safe-area padding, and transitions remain unchanged.

## Scope

This affects every consumer of `BaseBottomSheet`, including the avatar picker. It does not change regular dialogs that use `.agreement-modal`.

## Verification

Run the project build and checks after the CSS change. Manually confirm that a long avatar-picker list scrolls inside a bottom-anchored sheet whose top stays no higher than the midpoint of the dynamic viewport.
