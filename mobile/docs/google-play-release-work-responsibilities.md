# Google Play Release Work Responsibilities

This document categorizes the remaining Google Play release work by what Codex
can complete directly, what requires external inputs, and what must be
completed or approved by the product owner.

## Codex Can Complete Directly

- Add strict production configuration validation so invalid release builds
  fail.
- Disable unfinished Calendar, AI, or Premium features in production.
- Remove `Price pending` and other release-placeholder behavior.
- Harden subscription purchase, restore, and management flows after the
  product identifiers and backend contracts are available.
- Configure Android backup exclusions or disable application backup.
- Bundle Google Fonts locally and remove runtime font requests.
- Improve route-level code splitting and reduce the initial bundle size.
- Reconcile application version metadata and release documentation.
- Add release-check scripts and automated tests.
- Audit private-note exclusion from synchronization, AI summaries, exports,
  diagnostics, and backups.
- Improve account deletion cleanup and failure handling.
- Prepare Android signing configuration that reads credentials from protected
  environment or Gradle properties.
- Create release, QA, Data Safety, and Play Console checklists.
- Re-run the complete publication audit after changes.

## Codex Can Help With External Inputs

### Backend integration and live contract testing

Requires a reachable backend environment or access to its source repository.
Codex can validate health endpoints, API contracts, authentication, sync,
account lifecycle, provider integrations, and failure handling after access is
available.

### RevenueCat and Google Play Billing

Requires the final Google Play product identifiers, RevenueCat entitlement and
offering configuration, Android public SDK key, and trusted backend validation
endpoint. Codex can implement and test purchase, restore, management, and
entitlement-refresh behavior after these inputs are available.

### Production AI summaries

Requires the production backend AI provider and its documented request,
response, error, timeout, retention, and rate-limit behavior. Codex can complete
the mobile integration and failure-state QA without placing provider secrets in
the application.

### Google Calendar integration

Requires approved Google OAuth configuration, scopes, consent-screen details,
redirect handling, and backend endpoints. Codex can finish the mobile flow and
test connect, disconnect, revoke, and synchronization behavior after these
inputs are available.

### Signed Android App Bundle

Requires a compatible JDK and Android SDK plus the owner's upload keystore, or
authorization to generate a new upload keystore. Codex can configure signing,
build the AAB, inspect it, and document the secure release process.

### Store listing assets and copy

Codex can create or review listing text, screenshots, feature graphics, release
notes, and asset specifications. Final branding and marketing claims require
product-owner approval.

### Privacy Policy and Terms

Codex can prepare structured drafts, align disclosures with implemented
behavior, and update the in-app legal pages. Final documents still require
qualified legal review and approval.

## Product Owner Must Complete or Authorize

- Create and verify the Google Play Console developer account.
- Complete any required identity and Android-device verification.
- Enroll the application in Play App Signing.
- Provide or authorize creation of the upload keystore.
- Approve the final Privacy Policy and Terms after legal review.
- Submit and accept responsibility for the final Data Safety and policy
  declarations.
- Perform real-device QA or provide access to suitable Android devices and
  return test results for diagnosis.
- Recruit and maintain at least 12 opted-in testers for 14 continuous days when
  the new-personal-account testing requirement applies.
- Approve the final store listing, pricing, subscription products, territories,
  and rollout strategy.
- Authorize the final production rollout.

## Recommended First Implementation Batch

1. Add production configuration validation.
2. Harden Android backup and local-data privacy behavior.
3. Bundle fonts locally.
4. Hide or disable incomplete Premium, AI, and Calendar functionality.
5. Reconcile version metadata and release documentation.
6. Add a repeatable release-check command.

After this batch, the next phase should connect and verify the backend,
subscriptions, AI summaries, and Calendar integration before generating the
signed release candidate.
