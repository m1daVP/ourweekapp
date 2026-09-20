# Meeting delete toast design

## Goal

Prevent the meeting delete recovery toast from clipping its action on narrow Android screens while keeping the recovery affordance clear and quick to tap.

## Scope

This change affects only the shared in-app toast used when a meeting note, task, or agreement is removed. It does not change deletion, restoration, toast timing, native-toast behavior, or other notifications.

## Interaction and layout

- Replace the textual Ukrainian action label “Скасувати” with a Material `undo` icon for all action-based web toasts.
- The icon action remains a 48px square touch target and has a descriptive accessible label, derived from the existing action label, so assistive technology still announces the recovery action.
- The toast uses a two-column layout: the message column may shrink and wrap; the icon action never shrinks or overflows the toast.
- Keep the existing warm white pill, elevated treatment, safe-area offset, and no-blur behavior.

## Architecture

`AppShell.vue` continues to render the action and call the existing toast callback. It adds the `undo` icon and binds the action label to `aria-label`. `main.css` changes the toast from a flex row to an explicit `minmax(0, 1fr) auto` grid, allowing its content to wrap while reserving the action target.

## Verification

Update the app-shell test to assert that action toasts expose the labelled undo icon and still invoke their callback. Test the layout on a 360px mobile viewport, then run focused tests, the production build, formatting/lint checks, and the UI design detector.
