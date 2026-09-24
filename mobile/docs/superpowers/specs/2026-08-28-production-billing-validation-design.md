# Production Billing Validation Design

## Goal

Prepare OurWeek's Premium billing implementation for production release by
hardening the backend-trusted entitlement path, covering critical regressions,
reviewing store-facing subscription copy, and documenting the remaining
RevenueCat, Google Play, deployment, and real-device validation work.

## Scope

This design implements the repository-controlled portions of launch Milestone 2. It does not claim that production RevenueCat or Google Play configuration,
physical-device testing, or store submission has been completed. Those actions
are recorded in a version-controlled operator runbook with explicit evidence
fields for the release owner to complete.

Milestone 3 remains out of scope. This work may correct subscription copy and
the trust boundaries used by purchase-related paths, but it does not undertake
a broad consistency redesign of every billing entry point.

## Architecture

The backend remains the sole authority for a workspace's Premium entitlement.
The native RevenueCat SDK is permitted to show store purchase and restore
flows, but it never directly unlocks backend-protected features. After a
purchase or restore, the mobile app obtains its entitlement state from
`GET /v1/subscriptions/status`; the backend validates the workspace's
RevenueCat subscriber record, persists the resolved workspace subscription,
and returns a stable DTO.

RevenueCat webhooks and authenticated status/restore requests use the same
`SubscriptionService.syncEntitlementForWorkspace` path. This ensures that
purchase, renewal, expiration, refund, cancellation, and transfer events
ultimately result in the same workspace-scoped subscription state. If live
validation is unavailable, the backend may retain Premium only within the
existing short trust window; stale, expired, revoked, or otherwise untrusted
records resolve to Free.

## Components and Data Flow

1. The native provider starts a purchase or restore using the workspace ID as
   the RevenueCat app-user ID.
2. The mobile subscription store refreshes from the backend rather than
   treating the native SDK result as an entitlement grant.
3. `SubscriptionService` retrieves RevenueCat customer data, maps the
   configured entitlement to a provider, plan, status, expiry, and check time,
   then writes that record scoped by `workspace_id`.
4. Feature middleware evaluates the persisted subscription using the trust
   window and explicit allowed Premium statuses.
5. RevenueCat invokes the protected webhook. The webhook verifies its shared
   secret, safely handles unknown or missing workspaces, and asks the same
   service to refresh the affected workspace(s).

## Error Handling and Safety

- Missing RevenueCat configuration or webhook secret keeps billing disabled or
  returns a stable safe error; no endpoint grants Premium as a fallback.
- Provider timeouts and server failures do not leak provider details. Status
  reads use only a recently verified cached Premium record; stale records
  downgrade safely to Free.
- Restore and subscription-management endpoints remain owner-only on both the
  backend and client. Workspace identity, not an arbitrary body parameter or
  device identity, determines the queried entitlement.
- Webhook authorization is compared in constant time. Logs record event IDs,
  event types, and workspace IDs only; they do not contain secrets or customer
  data beyond the billing identity required to diagnose an event.

## Store-facing Copy

Each purchase surface must show the actual configured product price and billing
period supplied by RevenueCat, state that payment renews automatically unless
cancelled, and tell the workspace owner where to manage or cancel the
subscription. Copy must not promise a price, renewal term, or store behavior
that differs from the configured Google Play product.

## Verification

Automated tests will cover entitlement grant/revocation mapping, stale-cache
rejection, owner boundaries, webhook authorization, webhook transfer and
unknown-workspace handling, and native-provider results that must refresh the
backend authority before UI state changes. Existing type checks and relevant
test suites will run after implementation.

The operator runbook will provide exact external setup and physical Android
test steps for purchase, restore, management/cancellation, renewal, expiry,
refund, reinstall, webhook delivery, and backend-state verification. It will
include an evidence table for the release owner to record device, account,
product, date, result, and issue link for every scenario.

## Completion Boundaries

The codebase is ready for production billing only when the automated checks
pass and the release owner has completed the runbook with real RevenueCat and
Google Play configuration plus successful physical-device evidence. Until
then, paid Premium must remain unavailable to public users.
