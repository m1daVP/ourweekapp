# Inline status notifications

## Goal

Replace temporary, page-bound success and short feedback messages with one calm
in-app notification surface. A confirmation, such as the completed account
export message, must not remain in the page indefinitely.

## Scope

- Keep the existing native Capacitor toast behavior unchanged.
- Add a separate shared notification composable and app-shell surface for
  transient feedback previously rendered inline.
- Show the notification near the top of the screen, below the safe area,
  approximately 30--50px from the top edge.
- Animate the card down when it appears and upward out of view when it closes.
- Dismiss standard feedback after 3 seconds. A newer notification replaces the
  existing one and restarts the timer.
- Convert short-lived completion and feedback messages including account export,
  account linking, task and private-note changes, password-reset confirmation,
  calendar feedback, and comparable settings/subscription confirmations.

## Exclusions

- Do not replace native system toasts.
- Do not move field-level validation into the notification surface.
- Do not auto-dismiss persistent, actionable failures or current-step guidance;
  those remain inline until the user can act or the relevant state changes.
- Do not change local-device reminder notifications.

## Design

The app shell owns rendering, accessibility announcements, and the enter/leave
transition. A small shared composable owns the single active notification and
its cleanup timer, so routing or component unmounts cannot leave stale inline
confirmation text behind.

The notification supports neutral/success and error tones. It uses the existing
OurWeek visual tokens and a compact icon-led card. It has no close control;
users can dismiss it with a deliberate upward swipe, while taps and small
movements do not dismiss it. Standard messages use the 3-second timeout;
explicit persistent/actionable cases are not migrated to it.

Components that currently write a transient `meeting-status` value call the
shared notification composable instead. They retain local state only when it is
necessary for screen-specific validation or recovery.

## Verification

- Unit-test automatic dismissal at 3 seconds and replacement behavior.
- Test that the export success message is no longer rendered in the Settings
  card and appears in the top notification instead.
- Test that native-toast calls still use their current code path.
- Run `npm run build` and `npm run check`.
