# RevenueCat Purchase Identity Race Design

## Problem

An Android sandbox purchase can complete in Google Play and RevenueCat while the
OurWeek app still has an anonymous RevenueCat customer identity. The app starts
`logInRevenueCat(workspaceId)` after authentication without awaiting it so that
billing availability cannot delay sign-in. Purchase, paywall, restore, and
customer-info operations currently do not wait for that same identity operation.

If a purchase wins this race, RevenueCat can emit a webhook whose `app_user_id`
is an anonymous identifier such as `$RCAnonymousID:...` rather than the
workspace UUID. The API currently passes every non-empty `app_user_id` to a
repository query against the UUID `subscriptions.workspace_id` column. That
query fails before the entitlement can be stored. The public Sentry event shows
this exact failure path, although its shared view omits the underlying database
code and app-user ID. The root cause is therefore a high-confidence inference
from the event stack and current client/API control flow.

Navigating away from the Upgrade page does not cancel the store purchase. It
only makes the race visible because activation continues asynchronously and
eventually reports that Premium activation is pending.

## Goals

- A purchase or restore must use the authenticated workspace UUID as the
  RevenueCat app-user ID.
- Authentication must remain usable when RevenueCat is slow or unavailable.
- Anonymous or otherwise invalid RevenueCat webhook identities must not reach a
  PostgreSQL UUID query or create noisy unhandled Sentry events.
- The existing trusted backend entitlement remains the only source that unlocks
  Premium.
- The existing Restore Purchases action remains the recovery path for a valid
  store purchase that was initially associated with an anonymous customer.

## Non-Goals

- Do not grant Premium from client-side RevenueCat state alone.
- Do not add a database mapping from arbitrary RevenueCat anonymous IDs to
  workspaces; the API cannot authorize such a mapping safely.
- Do not block general authentication on RevenueCat network availability.
- Do not change product identifiers, offerings, pricing, or entitlement names.
- Do not add a database migration.

## Chosen Approach

Harden both sides of the integration.

On the client, keep RevenueCat identity synchronization non-blocking for the
overall authentication flow, but retain its promise inside the RevenueCat
service. Billing operations that can read, restore, or modify entitlement state
must await the current identity promise before calling the RevenueCat SDK.

On the API, treat the webhook identity as provider input rather than a trusted
database identifier. Validate it as a UUID before calling the subscription
service. A non-UUID identity is acknowledged with HTTP 200 and logged as a safe,
structured warning. This prevents futile RevenueCat retries and avoids passing
anonymous identifiers into UUID queries. The log must identify the event and
the identity category without recording a full anonymous RevenueCat ID.

This combination prevents new anonymous purchases while making the webhook
boundary robust against anonymous events created by old app versions, provider
retries, and other clients.

## Client Design

### Identity lifecycle

`revenueCatService.ts` will own the in-flight workspace identity operation.
`logInRevenueCat(workspaceId)` will register the promise for configuring the SDK
and logging in to that workspace. The auth store may continue to invoke it
without awaiting it.

An internal identity-ready helper will await the registered operation. Billing
methods that require customer identity will call this helper before the SDK:

- `purchasePackage`
- `restoreRevenueCatPurchases`
- `getRevenueCatCustomerInfo`
- `presentPremiumPaywall`
- `presentRevenueCatCustomerCenter`

Offerings may continue loading without waiting because catalog retrieval does
not mutate or prove a customer's entitlement. The eventual purchase call is
the enforcement boundary.

The identity promise must be cleared or replaced safely when logout starts so
an operation from a previous workspace cannot become the gate for a later
session. Promise rejection remains visible to the billing operation, which will
surface the existing safe purchase/restore failure instead of purchasing under
an anonymous identity.

### Navigation behavior

The Pinia subscription store already owns purchase state outside the Upgrade
page component. No page-specific continuation will be introduced. Navigating
away may hide the initiating screen, but it must not alter the RevenueCat
identity gate or make anonymous purchasing possible.

### Activation and recovery

After a successful SDK purchase, the app will continue calling the authenticated
backend restore/validation endpoint. Premium is applied only when that endpoint
returns a trusted Premium snapshot.

For the already affected sandbox purchase, Restore Purchases will first wait
for workspace identity, ask RevenueCat to restore the store purchase, and then
request backend validation. This is the supported recovery path; the backend
will not infer ownership of an anonymous RevenueCat customer.

## API Design

The webhook route will classify `event.app_user_id` before calling
`syncEntitlementForWorkspace`:

- Missing identity retains the existing `400 validation_failed` response.
- Valid UUID identity follows the existing entitlement synchronization path.
- Non-UUID identity returns `{ "received": true }` with HTTP 200 and emits a
  warning containing `eventId`, `eventType`, and an identity category such as
  `anonymous` or `invalid`.

The full invalid identifier must not be logged. Existing handling for provider
404s, provider outages, unknown UUID workspaces, and transfer events remains in
place.

Transfer events require the same UUID classification for every source and
destination identifier. Invalid entries are skipped while remaining valid
workspace UUIDs continue syncing. This preserves partial progress for a transfer
containing both anonymous and workspace identities.

No repository relaxation or database migration is needed. Repository methods
continue accepting workspace UUIDs under the service contract.

## Error Handling and Observability

- A failed RevenueCat workspace login blocks billing operations, not sign-in.
- Client failures use the current localized purchase/restore error paths and
  privacy-safe logging.
- Invalid webhook identities are expected provider-boundary events, acknowledged
  and logged as warnings rather than thrown as database errors.
- Provider and database failures for valid UUID workspaces retain their current
  status-code mapping.
- No tokens, store receipts, authorization headers, or full anonymous customer
  identifiers are logged.

## Testing

Client tests will prove that:

- a purchase started while RevenueCat login is pending does not call
  `Purchases.purchasePackage` until login completes;
- restore and customer-info refresh use the same identity gate;
- a rejected identity operation prevents the billing SDK operation;
- logout/session replacement does not reuse a stale identity promise;
- the existing purchase activation and pending-activation behavior remains
  intact after identity succeeds.

API route tests will prove that:

- a non-UUID non-transfer `app_user_id` is acknowledged without calling the
  subscription service;
- a transfer skips anonymous/invalid identifiers and still syncs valid UUIDs;
- a valid UUID retains the existing synchronization behavior;
- missing IDs and existing provider/database failure mappings are unchanged.

Both repositories must pass focused tests and TypeScript typechecking. The API
must also pass its full test suite because the webhook is a billing boundary.

## Rollout and Manual Verification

1. Deploy the API webhook guard first so events from old clients stop failing at
   the UUID query boundary.
2. Release the Android client with the RevenueCat identity gate.
3. Sign in as a workspace owner and immediately start a sandbox yearly purchase
   while identity initialization is deliberately delayed.
4. Navigate to History while the Play purchase is completing.
5. Confirm the SDK purchase waits for workspace login, the webhook uses the
   workspace UUID, and the backend returns a Premium snapshot.
6. Use Restore Purchases on the affected tester account and confirm Premium is
   recovered for the authenticated workspace.
7. Confirm no new `subscription_lookup_failed` Sentry event is created for an
   anonymous RevenueCat webhook.

## Risks

- RevenueCat alias/restore behavior determines whether the already affected
  sandbox transaction can be recovered automatically. If Restore Purchases does
  not associate it with the logged-in workspace, the sandbox transaction may
  need to expire or be reset in RevenueCat/Google Play test tooling.
- A stale identity promise could bind billing to the wrong workspace. Session
  replacement and logout tests are therefore required.
- Acknowledging invalid webhook identities intentionally drops events the API
  cannot authorize. The warning log preserves an operational signal without
  creating retry storms or unsafe identity mappings.
