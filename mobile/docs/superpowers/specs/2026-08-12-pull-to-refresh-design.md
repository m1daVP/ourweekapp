# Pull-to-Refresh Design

## Goal

Add a standard mobile pull-down refresh gesture to the Home, Tasks, History,
and Settings pages. Refreshing keeps the current route open, retrieves the
latest backend-backed app data, and gives short, calm feedback.

## Scope

- Enable pull-to-refresh only on the `home`, `tasks`, `history`, and `settings`
  routes.
- Do not enable it in meeting, summary, detail, template, upgrade, account,
  authentication, or other nested flows.
- Refresh meetings, tasks, agreements, participants, and workspace data on all
  four supported pages.
- Also refresh trusted subscription state on Settings.
- Reuse the current backend sync and merge rules. Do not reload the WebView,
  replace local-first persistence, or add a dependency.

## Interaction

1. The gesture can begin only when the shared `.app-main` scroll container is
   at the top and no refresh is running.
2. A downward touch drag reveals a compact indicator above the page content.
   Its movement uses resistance and is capped so the content cannot be dragged
   an excessive distance.
3. Before the threshold, the indicator says "Pull to refresh." At the threshold
   it changes to "Release to refresh."
4. Releasing before the threshold returns the page to rest without a request.
   Releasing at or beyond the threshold starts one refresh and shows a spinner
   with "Updating..." until it settles.
5. A successful refresh returns the indicator to rest and shows "Page updated."
   through the existing toast system.
6. Offline or failed refreshes return the indicator to rest and show the
   existing calm sync/offline error copy. Locally saved data remains visible.
7. Horizontal movement, upward movement, touch cancellation, route changes,
   and a second touch while refreshing cancel or ignore the gesture safely.

The gesture must not interfere with ordinary scrolling after the page has moved
away from the top. Touch handling becomes active only after a primarily vertical
downward drag is recognized. Animation respects `prefers-reduced-motion`.

## Architecture

### Gesture controller

Create a focused shared composable for pull gesture state and lifecycle. It
accepts:

- the scroll-container element;
- a reactive enabled flag;
- one asynchronous refresh callback.

It exposes the current pull distance and the states needed by the indicator:
idle, pulling, ready, and refreshing. The controller owns touch listeners,
threshold calculation, cancellation, duplicate-request prevention, and cleanup.
It does not know about routes, stores, sync APIs, or toast copy.

Keep distance and threshold decisions in small pure helpers so gesture behavior
can be tested without a browser rendering dependency.

### App shell integration

`AppShell.vue` owns the only shared page scroll container, so it will:

- enable the controller for the four approved route names;
- render one indicator at the top of `.app-main`;
- pass the manual refresh callback to the controller;
- show localized success or failure feedback with the existing toast composable;
- reset gesture presentation when the route changes.

This keeps the four page components free of duplicate gesture code and makes
unsupported routes opt out by default.

### Manual refresh coordinator

Add a small shared refresh coordinator that composes existing operations rather
than reimplementing sync:

1. Reload workspace state from the trusted backend.
2. Run the existing core-data sync for participants, meetings, tasks, and
   agreements, preserving its conflict merge and local persistence behavior.
3. On Settings, refresh the subscription provider and trusted entitlement state.

The coordinator returns only after all required work settles. It rejects with a
friendly outcome if a required operation fails, while the underlying services
retain their current local-data safety behavior. One in-flight coordinator call
is shared so a pull cannot start duplicate sync requests.

## Visual and Accessibility Behavior

- The indicator is compact and uses the existing visual tokens and a small
  spinner/refresh icon; it must not look like a new page header.
- Indicator text is localized for every locale already supported by the app.
- Status changes are exposed with a polite live region, without repeatedly
  announcing every drag-distance change.
- The spinner is decorative when accompanying visible status text.
- Touch scrolling remains the primary interaction; no desktop-only affordance
  or hover state is introduced.
- Reduced-motion users see immediate state changes rather than pull/rebound
  transitions.

## Error Handling

- Offline refresh uses the existing offline sync message.
- Other failures use the existing friendly sync failure message unless a
  service already provides a more specific safe message.
- Raw backend, authentication, or provider errors are not shown or logged with
  sensitive details.
- A failure does not clear, replace, or hide locally persisted page data.
- Gesture state always returns to idle in a `finally` path.

## Verification

- Unit-test pull distance resistance, threshold transitions, cancellation, and
  duplicate-refresh prevention.
- Verify refresh is enabled for Home, Tasks, History, and Settings and disabled
  for meeting and nested/detail routes.
- Verify a short pull does not call the coordinator and a threshold pull calls
  it exactly once.
- Verify success and failure both restore the page position and permit a later
  refresh.
- Verify Settings requests a subscription refresh while the other supported
  pages do not.
- Manually test top-of-page activation, normal scrolling, horizontal gestures,
  offline behavior, reduced motion, and Android WebView touch behavior.
- Run `npm run build` and `npm run check`.
