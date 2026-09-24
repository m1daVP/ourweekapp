# Top notification drag-dismiss interaction

## Goal

Make the top in-app notification feel directly responsive to touch while keeping pull-to-refresh unchanged.

## Interaction

- A pointer drag that moves upward more than it moves sideways shifts the notification upward in real time.
- The drag offset is clamped at 0px, so the notification never moves below its default resting position.
- Once the live upward offset reaches 15px, the notification dismisses immediately, without waiting for release.
- A short upward drag released before 15px returns the notification to its resting position.
- Downward, sideways, and cancelled gestures leave the notification at its resting position.
- The notification captures the active pointer while it is dragged, and has `touch-action: none` so browser scrolling does not cancel its own gesture.

## Implementation boundary

`AppShell.vue` owns a local pointer-start coordinate and visual drag offset for the rendered `.in-app-notification`. Pointer movement updates only that element’s transform. Pointer release and cancellation clear gesture state. Existing pull-to-refresh markup and handlers are untouched.

## Verification

- Add rendered component tests for live drag offset, the 15px immediate dismissal, downward clamping, and release/cancellation reset.
- Run the focused AppShell test, build, targeted formatting/lint, and UI detector.
