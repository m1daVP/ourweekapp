# Billing UI Consistency Design

## Goal

Complete launch Milestone 3 by making every subscription entry point follow
the same ownership, loading, safe-feedback, and backend-trusted entitlement
rules.

## Scope

This change is limited to the mobile app's Settings, Account, and Upgrade
subscription surfaces, their shared Pinia subscription state, and focused
regression tests. It does not change RevenueCat configuration, backend billing
endpoints, entitlement validation, data schema, or subscription pricing.

## Current State

Upgrade already limits Restore purchases and Manage subscription to workspace
owners, disables its controls while the applicable request is in progress or
native billing is unavailable, and renders the subscription store's safe
success and error messages. Settings already limits Restore purchases but its
Manage subscription action checks Premium and provider support without an
explicit owner check.

Account currently presents subscription information to every role, but also
renders Restore purchases without a workspace-role check and only renders a
success message. That permits adult members and viewers to start an action
they cannot complete, and it can leave an owner without visible in-place error
feedback.

## Design

### Read-only subscription information

All authenticated workspace roles retain access to the Account subscription
card's read-only plan, renewal, and management-availability information. This
keeps adult members and viewers informed without exposing billing-management
actions.

### Owner-only billing actions

Use the existing `canPurchasePremium(workspaceStore.currentUserRole)` policy
on Account, as Settings and Upgrade already do. Only a workspace owner can
see or invoke Restore purchases or Manage subscription.

The Account Restore purchases control calls the existing
`subscriptionStore.restorePurchases()` action. It remains disabled while
`subscriptionStore.isRestoring` is true or `appConfig.isRevenueCatEnabled` is
false. Any Account management control, if present, uses the existing
`subscriptionStore.manageSubscription()` action and is disabled while
`subscriptionStore.isManaging` is true.

Settings will add the same explicit owner check to its existing Manage
subscription action. Upgrade preserves its current owner-only gating and both
pages retain their respective in-progress/native-configuration disabled states.
No page calls RevenueCat or the backend directly.

### Result feedback

Each billing surface displays the store's localized `statusMessage` with
`role="status"` and its sanitized `errorMessage` with `role="alert"` next to
the action area. A store action clears stale messages before beginning, so the
visible result always applies to the latest purchase, restore, or management
attempt. Error text remains the existing user-safe message; provider responses,
tokens, and backend internals are not exposed.

### Entitlement authority

All three pages continue to display `useSubscriptionStore()` state. That store
refreshes entitlement state through the backend after native billing actions;
the native provider never unlocks Premium directly. UI changes must not create
separate plan, entitlement, or permission state.

## Testing

Add or extend DOM-based page tests to verify the following:

- Owners see Restore purchases and can invoke the existing store action.
- Adult members and viewers do not see Restore purchases or Manage
  subscription actions, while Account's read-only subscription details remain
  visible.
- Restore and management actions are disabled during their corresponding
  in-progress state and Restore is disabled when RevenueCat is unavailable.
- Each applicable page renders both the subscription store's success and safe
  error messages in the action area.

Keep the existing service-level tests that prove native billing results refresh
the backend-trusted entitlement snapshot.

## Acceptance Criteria

- Adult members and viewers never see billing-management actions on Settings,
  Account, or Upgrade.
- Owners receive clear, localized result feedback after a purchase restore or
  subscription-management attempt succeeds or fails.
- Billing controls cannot be repeated while their request is active and cannot
  start Restore when native billing is not configured.
- Settings, Account, and Upgrade continue to use one backend-trusted
  subscription store for plan and entitlement state.
- Focused page tests cover ownership, loading/configuration, and feedback
  regressions.
