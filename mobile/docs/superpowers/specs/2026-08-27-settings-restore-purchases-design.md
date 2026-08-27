# Settings Restore Purchases Design

## Goal

Let a workspace owner restore a native Premium purchase directly from Settings,
without navigating to the Upgrade screen.

## Scope

The change is limited to the mobile app Settings subscription card. The existing
backend restore endpoint and RevenueCat-backed subscription service remain the
source of truth for entitlement validation.

## Behavior

- Show a **Restore purchases** action only to the workspace owner.
- Keep it available whether the displayed plan is Free or Premium, because a
  restored store entitlement can correct stale local or backend subscription
  state.
- Reuse `subscriptionStore.restorePurchases()`; it restores through RevenueCat
  and then refreshes the entitlement through the authenticated backend API.
- Disable the action while restoration is in progress and when RevenueCat
  billing is not configured, matching the existing Upgrade page behavior.
- Render the subscription store's existing localized success or error feedback
  within the Settings subscription card so the result is visible where the
  action was initiated.
- Do not show the action to adult members or viewers. The backend's existing
  owner-only authorization remains the enforcement boundary.

## UI placement

Place the action in the current Settings subscription card with the existing
Upgrade and Manage subscription actions. It is a secondary button/link-style
action, not a new screen or modal.

## Error handling

Use the existing store behavior and translated messages. Provider, network, and
validation failures keep their safe client-facing messages; no provider details
or tokens are exposed.

## Verification

- Add a focused Settings-page test for owner visibility and invocation.
- Cover hidden state for non-owners and disabled state while restoring or when
  billing is unavailable.
- Run the app build and quality checks.
