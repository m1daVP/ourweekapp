# Subscription Billing Notes

OurWeek currently uses `mockSubscriptionProvider` only. The mock provider is
for browser and local development paywall behavior; it is disabled from granting
Premium in production builds.

## Recommended MVP Billing Path

Prefer RevenueCat for the first production billing implementation:

- one Capacitor SDK can cover Google Play Billing and Apple In-App Purchases;
- products can map to one `premium` entitlement;
- receipt and subscription status handling are managed by a trusted provider;
- the app can keep UI code behind `SubscriptionProvider` instead of branching on
  Android and iOS store details.

Direct store billing can still fit this architecture later, but it should live
behind the same provider contract and send store purchase tokens or signed
transactions to a backend before unlocking Premium.

## Production TODOs

- Add a native provider, likely `@revenuecat/purchases-capacitor`.
- Configure RevenueCat products for `ourweek_premium_monthly` and
  `ourweek_premium_yearly`.
- Attach both products to a `premium` entitlement.
- Validate entitlements through RevenueCat trusted status and/or the backend.
- Add store subscription management redirects when native billing is configured.
- Do not persist permanent Premium access from local frontend state in
  production.
