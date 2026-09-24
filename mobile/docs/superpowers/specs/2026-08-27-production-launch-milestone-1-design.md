# Production Launch Milestone 1 Design

## Goal

Prepare OurWeek for production account creation and paid release by replacing
draft legal content, providing a public no-login deletion-request route, and
recording the evidence needed to complete Google Play Data Safety disclosures.

## Legal operator and contact

The controller and service operator is the CEIDG-registered sole proprietor
`VADYM PASICHNYK - WebWave`. The published policies will use the registered
correspondence address, NIP, and REGON from the supplied CEIDG record, plus
`ourweekapp@gmail.com` for support and privacy requests.

The published policies will be English only. English is the authoritative
version for this launch; no Ukrainian or Spanish legal translation will be
published until independently reviewed.

## Public deletion-request route

The landing site will add a public `/delete-account` page and link to it from
the footer. This page is the URL to supply in Google Play Console.

- It loads without authentication and identifies both OurWeek and its operator.
- It contains a prominent pre-addressed `mailto:` link to
  `ourweekapp@gmail.com` with an account-deletion subject.
- It asks users to send the request from the email address on their OurWeek
  account, and explains that support may ask for proof of account control.
- It describes deletion or anonymization within 30 days of a verified request
  and the 90-day expiry period for backup copies.
- It explains that users should cancel any store subscription through the
  relevant app store, and that a shared workspace can remain available to its
  other members after the requester is removed.

The public path initiates a manual, verified support flow. No anonymous
deletion API, account-lookup API, or new database table will be introduced.
Those would materially increase account-takeover and data-exposure risk.

## In-app deletion and legal access

The existing authenticated account-deletion endpoint remains the immediate
self-service path. It revokes sessions and Google Calendar credentials,
removes the user from active workspaces, transfers ownership where a qualifying
member remains, and soft-deletes the account. The mobile app's local cleanup
flow remains unchanged.

Account settings will visibly point to the public deletion page as the fallback
for users who cannot sign in. The existing in-app Privacy and Terms routes will
remain, with their draft copy replaced by the canonical English policy and
terms text for every app locale. This prevents a locale from surfacing stale or
unreviewed legal copy.

## Privacy Policy

The policy will cover the website and mobile app and describe only implemented
or intentionally enabled behavior:

- account, authentication, workspace, participant, meeting, task, agreement,
  export, and subscription-entitlement data;
- local-only private notes and local reminder settings;
- Supabase/backend sync;
- optional Google Play and RevenueCat billing;
- optional Sentry diagnostics;
- optional OpenAI summaries; and
- optional Google Calendar integration.

It will state purposes, processors, applicable international transfers,
retention, deletion and export routes, data-subject rights, and the contact
process. It will not claim encryption, analytics, diagnostics, billing, AI, or
Calendar behavior unless that behavior is enabled for production.

## Terms of Service

The terms will cover acceptable use, user responsibility for shared household
content, optional AI and Calendar features, app-store billing and cancellation,
service limitations, the absence of therapy/legal/financial/emergency advice,
Polish governing law subject to mandatory consumer protections, and the legal
operator's contact details.

## Google Play Data Safety evidence

`docs/google-play-data-safety.md` will become the final evidence checklist for
Play Console. It will identify the categories collected, whether each category
is shared, purpose, data handling, account deletion process, and
`https://ourweekapp.com/delete-account` as the external deletion URL.

The actual Data Safety submission remains a manual launch task performed in
the authenticated Play Console account after production providers and their
configuration are confirmed.

## Error handling and security

- The deletion page is static and does not submit or store user data.
- If no mail client is available, the policy displays the support email in
  visible text so users can copy it.
- Support verifies control of the account before invoking the existing
  deletion operation; support never requests a password, token, or payment
  credential.
- The policies distinguish immediate account-access removal from the stated
  data-deletion and backup retention periods.

## Verification

- Build the landing site and verify direct access to `/delete-account`,
  `/privacy`, and `/terms` without authentication.
- Add focused checks for the footer links, visible deletion-request path,
  support address, and retention text.
- Add mobile tests that all locale configurations render the canonical English
  legal text, and that Account settings exposes the fallback deletion URL.
- Preserve and run the existing account-deletion lifecycle tests.
- Review the final Data Safety checklist against enabled production providers
  before the Play Console submission.

## Boundary

This implementation prepares clear, accurate legal text and technical
disclosures, but it does not constitute legal review. A qualified legal review
is required before describing the policies as reviewed production terms.
