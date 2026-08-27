# Pull-to-Refresh Chip Design

## Goal

Make the pull-to-refresh status indicator read as a compact chip/badge with a
neutral soft surface background while preserving the current gesture behavior.

## Design

- Keep the existing pull-to-refresh indicator, status text, icon, phases, and
  transform/opacity transitions.
- Wrap the icon and non-idle status text in a dedicated visual chip element.
- Give the chip compact horizontal and vertical padding, a fully rounded
  radius, a neutral surface background, and a subtle border or shadow that
  fits the existing design tokens.
- Preserve the current text colors, including the primary color in the ready
  state.
- Keep the outer indicator's zero-height layout behavior so the chip does not
  change page content positioning while idle or during the gesture.

## Scope

Only the shared `AppShell.vue` markup and related pull-to-refresh styles in
`src/styles/main.css` will change. No gesture logic, translations, routes, or
data refresh behavior will change.

## Verification

- Run the focused pull-to-refresh tests if available.
- Run `npm run build`.
- Run `npm run check`.
- Confirm the working tree contains no unrelated modifications beyond the
  pre-existing change in `scripts/ping-health.mjs`.
