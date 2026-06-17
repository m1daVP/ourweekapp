# Subscription Billing Notes

OurWeek uses `mockSubscriptionProvider` for browser and local development and
`revenueCatSubscriptionProvider` for native store billing when backend
validation is enabled. The mock provider is disabled from granting Premium in
production builds.

## Recommended MVP Billing Path

Prefer RevenueCat for the first production billing implementation:

- one Capacitor SDK can cover Google Play Billing and Apple In-App Purchases;
- products can map to one `OurWeek Premium` entitlement;
- receipt and subscription status handling are managed by a trusted provider;
- the app can keep UI code behind `SubscriptionProvider` instead of branching on
  Android and iOS store details.

Direct store billing can still fit this architecture later, but it should live
behind the same provider contract and send store purchase tokens or signed
transactions to a backend before unlocking Premium.

## Production TODOs

- Configure RevenueCat products for `monthly` and `yearly`.
- Attach both products to the `OurWeek Premium` entitlement.
- Validate entitlements through the backend after RevenueCat purchase or
  restore. Backend support must be enabled before the app sends RevenueCat
  validation payloads.
- Use RevenueCat Customer Center for subscription management when native
  billing is configured, with backend management URL fallback.
- Do not persist permanent Premium access from local frontend state in
  production.
