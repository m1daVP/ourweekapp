# Production Launch Milestones

This roadmap covers the minimum work required before a public paid release of
OurWeek. Milestones are ordered by dependency and launch risk.

## Milestone 1: Legal, privacy, and external account deletion

Make user data rights complete and store-compliant before collecting production
accounts or payments.

### Scope

- Replace draft in-app Privacy Policy and Terms with reviewed production text.
- Update the landing-site Privacy Policy and Terms so they cover the mobile app,
  not only the waitlist.
- Publish a public, no-login account-deletion page on the OurWeek website.
- Link that page in Google Play Console and make it easy to find from the app.
- Complete the Google Play Data Safety form using the final data map, including
  backend sync, RevenueCat, Sentry, AI, Google Calendar, notifications, and
  local device storage.

### Done when

- The policies identify the legal entity, support contact, data collected,
  processors, retention, deletion process, and user rights.
- An account owner can request deletion in-app and through the public website.
- The website deletion page is live, tested without authentication, and is the
  URL supplied to Google Play Console.
- Store disclosures match the final production behavior and approved policies.

### Implementation evidence

- [x] Canonical English mobile Privacy Policy and Terms are implemented and
      verified in every supported app locale.
- [ ] Public landing Privacy Policy and Terms are implemented and published.
- [ ] The public no-login deletion route is implemented and deployed at
      `https://ourweekapp.com/delete-account`.
- [x] Authenticated in-app account deletion is implemented through the existing
      account-deletion workflow; release testing must still confirm the deployed
      behavior and local-data cleanup.
- [x] Mobile and landing build verification has been recorded for the final
      implementation.
- [ ] Qualified legal review of the English Privacy Policy and Terms is
      complete.
- [ ] Production provider configuration (backend/Supabase, Google Play and
      RevenueCat, Sentry, OpenAI, Google Calendar, notifications, and local
      storage) has been verified against the Data Safety evidence checklist.
- [ ] Landing-site deployment and unauthenticated HTTP 200 verification of the
      public deletion route are complete.
- [ ] Google Play Console Data Safety submission is complete, including the
      account-deletion URL.

## Milestone 2: Production billing validation

Verify that paid Premium behaves correctly through the real stores and remains
trusted by the backend.

### Scope

- Configure production RevenueCat projects, entitlements, offerings, products,
  API keys, and webhook secret.
- Configure Google Play products and internal testing access.
- Validate purchase, restore, management/cancellation, renewal, expiration,
  refund, and reinstall flows on physical Android devices.
- Confirm that Premium unlocks only after backend validation and revokes safely
  when the entitlement is no longer active.
- Ensure subscription screens clearly state plan price, billing period,
  auto-renewal, and where the owner can manage or cancel the subscription.

### Done when

- Each billing scenario has a recorded internal-test result.
- RevenueCat webhook events update the correct workspace subscription state.
- The backend rejects untrusted or stale Premium state.
- Store-facing subscription copy has been reviewed against final product terms.

### Implementation evidence

- [x] Repository-controlled billing safeguards, regression coverage, and
      store-facing subscription disclosures are implemented. See the
      [production billing validation runbook](./production-billing-validation.md)
      for the required console configuration and real-device evidence.
- [ ] Production RevenueCat project, products, entitlement, offering, API key,
      and webhook are configured and verified.
- [ ] Google Play monthly and yearly products are configured and available to
      internal testers.
- [ ] The runbook evidence table records passing purchase, restore,
      management/cancellation, renewal, expiration, refund, reinstall, outage,
      and non-owner scenarios on physical Android devices.

## Milestone 3: Billing UI consistency

Make every subscription entry point follow the same ownership and feedback
rules.

### Scope

- Keep Restore purchases and Manage subscription owner-only across Settings,
  Account, and Upgrade screens.
- Add visible success and safe error feedback wherever a billing action begins.
- Keep actions disabled while requests are in progress or native billing is not
  configured.
- Add regression coverage for ownership, loading, and failure states.

### Done when

- Adult members and viewers never see billing-management actions they cannot
  complete.
- Owners receive a clear result after purchase restore or subscription
  management fails.
- Settings, Account, and Upgrade use the same backend-trusted entitlement
  state.

## Milestone 4: Signed Android release and real-device QA

Produce a repeatable signed Android build and verify the essential app journey
on supported devices.

### Scope

- Configure Android Studio, JDK, release keystore storage, signing, and Play
  Console internal testing.
- Produce a signed AAB and install it through the Play internal track.
- Test account creation/sign-in, restart/session restoration, offline edits,
  sync recovery, reminders permission states, narrow-screen layout, data
  export, account deletion, and billing flows.
- Verify app icon, splash assets, version metadata, privacy links, support
  email, and release notes are final.

### Done when

- A signed AAB is installed successfully from Google Play internal testing.
- The release checklist has evidence for every critical Android flow.
- All launch assets and store metadata are final rather than placeholder or
  draft content.

## Milestone 5: Production operations and launch controls

Ensure production issues can be detected, diagnosed, and recovered without
guesswork.

### Scope

- Configure frontend and backend Sentry DSNs, release labels, and owner alerts.
- Monitor API readiness, error rate, billing webhook failures, queue failures,
  and Google Calendar/AI provider failures.
- Verify production database backups and perform a restore rehearsal.
- Write a concise support runbook for login, sync, billing, deletion, and
  provider incidents.
- Set a release rollback plan, including pausing paid acquisition, disabling
  optional integrations, and reverting the mobile release track if necessary.

### Done when

- A test incident is visible in monitoring and routes to an accountable owner.
- Health checks and alert thresholds are documented and enabled.
- Database recovery has been tested, not merely assumed.
- Support can resolve the common launch failures using the runbook.

## Recommended release sequence

1. Complete Milestone 1 before opening public account registration.
2. Complete Milestones 2 and 3 before enabling paid Premium.
3. Complete Milestone 4 before submitting the first public Android release.
4. Complete Milestone 5 before expanding beyond a controlled rollout.
