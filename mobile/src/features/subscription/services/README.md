# Subscription Billing Notes

OurWeek uses `revenueCatSubscriptionProvider` for native store billing and
validates entitlements through the backend. Browser development uses the
backend provider for subscription status and management without simulating
purchases.

## Recommended MVP Billing Path

Prefer RevenueCat for the first production billing implementation:

- one Capacitor SDK can cover Google Play Billing and Apple In-App Purchases;
- products can map to one `OurWeek Premium` entitlement;
- receipt and subscription status handling are managed by a trusted provider;
- the app can keep UI code behind `SubscriptionProvider` instead of branching on
  Android and iOS store details.

## Production TODOs

- Configure RevenueCat products for `monthly` and `yearly`.
- Attach both products to the `OurWeek Premium` entitlement.
- Validate entitlements through the backend after RevenueCat purchase or
  restore.
- Use RevenueCat Customer Center for subscription management when native
  billing is configured, with backend management URL fallback.
- Do not persist permanent Premium access from local frontend state in
  production.
