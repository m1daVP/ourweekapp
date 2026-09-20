# Top notification upward-swipe dismissal

## Goal

Let a person dismiss an in-app notification shown at the top of the screen by swiping it upward.

## Interaction

- The gesture starts on the rendered `.in-app-notification` element.
- An upward pointer movement of at least 48px dismisses the notification only when its vertical distance exceeds its horizontal distance.
- Short upward movements, downward movements, sideways movements, and cancelled gestures leave the notification visible.
- The gesture is additive: it does not change pull-to-refresh behavior or its existing pointer handlers.

## Implementation boundary

`AppShell.vue` keeps the existing handler functions and stores the gesture start position locally. Its rendered top-notification element receives the pointer handlers. The pull-to-refresh element retains its current handlers unchanged.

## Verification

- Update the AppShell component test to dispatch the gesture on the rendered notification and verify dismissal.
- Add coverage that an insufficient, non-upward, or cancelled gesture does not dismiss it.
- Run the focused test, build, formatting/lint checks, and the UI detector for the changed component.
