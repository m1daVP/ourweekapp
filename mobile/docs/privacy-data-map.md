# OurWeek privacy data map

**Last reviewed:** 2026-09-17
**Canonical engineering inventory:** mobile, API, landing-page source, and the
evidence named below. It is not legal advice, a production configuration record,
or a store declaration.

## Scope and evidence boundary

This map describes the assessed source state, not a deployed release. Code can
establish designed data flow; it cannot establish a provider's active retention
setting, a hosting region, a deployed environment variable, store configuration,
or a legal basis.

| Repository | Revision inspected                         | Working-tree evidence                                                                                                 |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Mobile     | `5712c1f40095c29c942ecc678688732bf7b106c7` | Dirty; legal, account-deletion, diagnostics, AI-recap, localization, and unrelated meeting-summary work were present. |
| API        | `9833902ddb6c8dcae2f5e72eb3e6621dc459913d` | Dirty; retention/diagnostics evidence and implementation work were present.                                           |
| Landing    | `89eacd66e8ebb03588bd9354d7e7a0c312be135d` | Dirty; legal-page and root legal-Markdown work were present.                                                          |

Status vocabulary:

- **source_verified** — implementation and cited tests support the statement.
- **deployment_verified** — redacted runtime, provider, or release evidence confirms it.
- **decision_required** — product-owner or legal decision is required before final wording.
- **not_shipped** — the integration is absent or disabled in the assessed release.

No flow is deployment-verified unless it says so explicitly. The versioned API
contract is mounted by `API/src/routes/v1.routes.ts`; this map does not rely on
an ephemeral local OpenAPI URL.

## Data-flow records

### Accounts, authentication, and household membership

- **Source and people affected:** account holder; inviter and invitee; Google sign-in user where chosen.
- **Categories:** email, display name, user/workspace IDs, role, password-derived credentials, Google ID token during exchange, refresh-token hashes server-side, access/refresh tokens on-device, invitation token and membership status.
- **Purpose:** authenticate, create or join a household, secure sessions, and authorize workspace access.
- **Trigger and controls:** email/password or optional Google sign-in; invitation acceptance is user-initiated. `API/src/modules/auth/auth.schema.ts` and `MOBILE/src/pages/SignUpPage.vue` have no date-of-birth, minimum-age, guardian, or terms-acceptance field.
- **Storage / recipients:** native credentials use `MOBILE/src/shared/services/authTokenStorageService.ts`; API receives registration/sign-in data and invitation token; Google is involved only for optional Google sign-in.
- **Visibility / lifecycle:** credentials are not household-visible. Current deletion revokes sessions and soft-deletes the account; `account_restore` can restore an eligible account.
- **Basis / transfer:** **decision_required** — assess contract, security, invitations and Google identity separately.
- **Evidence / status:** auth schemas, signup page, secure-token service and `API/docs/account-retention-runbook.md`; **source_verified + decision_required**. Deployed identity providers, hosting and age/guardian policy are unverified.

### Participant profiles and shared household content

- **Source and people affected:** account holders, household members, and people represented by profiles, including `child` profiles.
- **Categories:** participant name, initials, avatar colour/type, `adult`/`child`/`other`, optional email; meeting titles/dates/sections/notes; tasks, agreements, review decisions and responsibility IDs.
- **Purpose / trigger:** organise weekly household meetings and shared follow-ups. People add content and choose invitations; participant type is not a verified age or separate login.
- **Storage / recipients:** local app envelope plus workspace-scoped backend sync; authorised household members can receive/view shared content.
- **Retention / deletion:** records follow the current soft-delete/restoration lifecycle. An eligible remaining adult can keep a shared household; sole-owner erasure is not implemented.
- **Basis / transfer:** **decision_required** for sensitive household content and third-party/child profiles; accepting terms is not a universal basis.
- **Evidence / status:** `API/src/modules/participants/participants.schema.ts`, `MOBILE/src/features/participants/participantInvitationEligibility.ts`, retention runbook; **source_verified + decision_required**.

### Private notes and local app data

- **Source and people affected:** private-note owner on that device.
- **Categories:** private-note title/body/related meeting ID/timestamps; local meeting cache, settings, reminder settings, calendar UI preferences and recovery backups.
- **Purpose / controls:** local-first app use and personal notes excluded from normal shared flows. Requesting-device cleanup is attempted on account deletion; users can clear app storage on another device after deletion.
- **Storage / recipients:** `MOBILE/src/features/private-notes/services/privateNotesStorageService.ts` stores notes in the app-data envelope. `MOBILE/src/shared/services/storageService.ts` uses browser local storage where available and Capacitor Preferences for settings. This is not an encryption-at-rest promise. Private notes are excluded from normal export and AI paths.
- **Visibility / lifecycle:** not intended to be shared or synced. Cleanup removes app/legacy/recovery-backup keys on the requesting device; failure is surfaced and retryable. Other devices and OS/cloud backups require confirmation.
- **Basis / transfer:** **decision_required** for device backups and any future sync design.
- **Evidence / status:** private-note service, storage service, account-deletion lifecycle and mobile tests; **source_verified + decision_required**.

### Local reminders and notifications

- **Source and people affected:** user who enables a reminder on a device.
- **Categories / purpose:** reminder enabled state, day/time, notification permission state and scheduled local notification; remind the user about a meeting or follow-up.
- **Trigger and controls:** user selects reminder settings and the operating system controls notification permission. Denial must leave the app usable.
- **Storage / recipients / visibility:** reminder settings and schedules are local device data; no source evidence shows reminder contents being sent to the OurWeek backend, another household member, or a third-party provider.
- **Retention / deletion / basis:** requesting-device cleanup attempts to cancel local reminders and clear local settings. Device/cloud-backup persistence and the appropriate legal classification remain **decision_required**.
- **Evidence / status:** `MOBILE/src/features/auth/components/AccountSettingsSection.vue`, `MOBILE/src/shared/services/storageService.ts` and account-deletion lifecycle tests; **source_verified + decision_required**.

### AI summaries

- **Source and people affected:** members whose selected shared meeting content is included; private-note owners are excluded.
- **Categories:** selected shared meeting notes, tasks, agreements, participant names, generated recap, timestamps and request/audit data. Source tests use markers to confirm private-note and participant-email exclusion.
- **Purpose / controls:** optional meeting recap. First-use acknowledgement is saved per user/version in `MOBILE/src/features/meeting/aiRecapDisclosure.ts`; users can choose not to generate a recap.
- **Storage / recipients:** acknowledgement is local settings data; recap/request state is backend-owned. OpenAI receives the selected recap payload through the backend. `store: false` does not mean zero provider retention.
- **Visibility / lifecycle:** generated recap is visible to members who can access the meeting. Source cannot prove deployed OpenAI retention/deletion; soft deletion can leave shared content for remaining members.
- **Basis / transfer:** **decision_required**, especially for sensitive household and third-party information.
- **Evidence / status:** `API/src/modules/ai/`, `API/tests/ai.summary-payload.test.ts`, recap disclosure and legal source; **source_verified + decision_required**.

### Google sign-in and Google Calendar

- **Source and people affected:** account holder connecting Google; people named in created event titles may be affected by Calendar sharing settings.
- **Categories:** Google ID token for sign-in; for Calendar, connected-account email, encrypted server OAuth credentials, mapping IDs, selected reminder/task/follow-up title/date/timezone and preferences.
- **Purpose / controls:** optional identity sign-in or Calendar operations for mapped events. User can disconnect Calendar. Google Cloud scopes and consent-screen settings must be checked in deployment.
- **Storage / recipients:** mobile sends authenticated Calendar API requests; backend owns the connection. OAuth credentials must not be stored in mobile app storage. Google receives the event fields needed for the requested operation.
- **Visibility / lifecycle:** Google Calendar controls event visibility. Disconnect attempts mapped-event deletion, revocation and credential clearing; failure may require retry. Restoration does not restore Calendar credentials.
- **Basis / transfer:** **decision_required** — distinguish Google identity and Calendar processing, scopes and safeguards.
- **Evidence / status:** `MOBILE/src/features/calendar/services/calendarService.ts`, `MOBILE/src/shared/api/calendarApi.ts`, `API/src/modules/calendar/calendar.schema.ts`, retention runbook; **source_verified + decision_required**.

### Subscription entitlement and app-store records

- **Source and people affected:** workspace owner purchasing or managing Premium.
- **Categories:** provider, provider customer/entitlement IDs, product ID, plan/status, expiry and last-checked time; no direct payment-card collection.
- **Purpose / controls:** show plans, validate entitlement, restore purchases and direct the owner to subscription management. Native RevenueCat credentials must be configured. Checked-in price fallback is `Price pending`.
- **Storage / recipients:** client UI snapshot; backend subscription records; RevenueCat and app stores are independent recipients. Actual store availability, product IDs, price, automatic renewal, trial, grace/billing retry and refunds are not source facts.
- **Visibility / lifecycle:** entitlement is workspace-level and management is owner-only. Account deletion does not cancel a store subscription; billing retention is undecided.
- **Basis / transfer:** **decision_required**.
- **Evidence / status:** RevenueCat provider/service, subscription plans, `API/src/modules/billing/billing.service.ts`, retention runbook; **source_verified + decision_required**.

### Exports, support, and account deletion

- **Source and people affected:** requesting account holder and, for shared export, people represented in exported content.
- **Categories / purpose:** account/meeting export content, support email, verification email and local cleanup result; portability, user-requested sharing, support and deletion.
- **Controls / recipients:** signed-in export/deletion is in Account settings; website provides a `mailto:` deletion route. User-selected export destinations control copies after sharing. Never request password or auth token via support.
- **Retention / deletion:** source verifies session revocation and soft deletion, not irreversible erasure, backup expiry or provider cleanup. Support-mailbox records, hosting logs and external provider copies have no verified duration. The existing public 30/90-day wording is not operational proof.
- **Basis / transfer:** **decision_required** for support retention, verification, billing exceptions and erasure timeline.
- **Evidence / status:** Account settings, retention runbook and `LANDING/src/pages/delete-account.astro`; **source_verified + decision_required**.

### Diagnostics, security logs, and website processing

- **Source and people affected:** app/API users triggering an error, website visitors and support correspondents.
- **Categories / purpose:** generic error type, selected stack metadata, release/environment and safe API route pattern; reliability, debugging and security. Website source includes optional Plausible/Fathom configuration.
- **Controls / storage / recipients:** Sentry starts only with a configured DSN and sends automatic allowlisted events; it is not a feature-specific opt-in. API Pino logs are separate. Hosting, proxy, email and analytics processing must not be inferred from source.
- **Retention / basis:** Sentry retention/access/IP settings, attachments, replay/tracing/log ingestion and website/hosting log settings are unverified. **decision_required** for automatic diagnostics and website analytics lawful basis.
- **Evidence / status:** mobile/API Sentry privacy services, `API/docs/diagnostics-privacy-evidence.md`, `LANDING/src/lib/analytics.ts`, `LANDING/src/lib/cookieConfig.ts`; **source_verified + decision_required**.

## Public-surface and store reconciliation

The tracked Astro pages are current website sources. Root
`LANDING/ourweek-privacy-policy.md` and `LANDING/ourweek-terms-of-service.md`
are untracked historical waitlist drafts with placeholders and no Astro imports.
Preserve them, but do not publish them as current mobile-app legal copy.

| Claim                       | Source fact                                                    | Mobile                            | Website                                 | Store mapping                                            | Evidence / status                                    |
| --------------------------- | -------------------------------------------------------------- | --------------------------------- | --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Controller/contact          | Operator and support email are in checked-in copy.             | Legal content                     | `/privacy`, `/terms`, `/delete-account` | Must match store developer identity/contact.             | source_verified; deployment confirmation required    |
| Shared visibility           | Household data is synced and visible to authorised members.    | Privacy policy                    | `/privacy`, `/terms`                    | Assess personal information/user-content categories.     | source_verified; legal/store review required         |
| Private notes               | Local app data, excluded from normal AI/export paths.          | Privacy policy                    | `/privacy`                              | Do not call uncollected before backup/SDK review.        | source_verified; deployment review required          |
| AI                          | Selected shared recap input goes to OpenAI on request.         | Privacy policy/disclosure         | `/privacy`                              | Assess collection/sharing with current Play definitions. | source_verified; provider/store review required      |
| Calendar                    | Optional Google connection/sync/disconnect exists.             | Privacy policy                    | `/privacy`                              | Verify scopes/consent and category mapping.              | source_verified; deployment/store review required    |
| Diagnostics                 | Conditional, sanitised Sentry error reports.                   | Privacy policy                    | `/privacy`                              | Include deployed SDK practices.                          | source_verified; deployment/legal review required    |
| Erasure/backups             | Soft delete plus restoration, no durable erasure lifecycle.    | Existing 30/90-day copy conflicts | Existing 30/90-day copy conflicts       | Do not represent freezing as deletion.                   | **release blocker**                                  |
| Local cleanup               | Requesting device cleanup is attempted/retryable.              | Privacy policy                    | `/privacy`, `/delete-account`           | Confirm native/backup behavior.                          | source_verified; deployment review required          |
| Subscription cancellation   | Deletion does not cancel store billing.                        | Terms                             | `/terms`, `/delete-account`             | Verify offers/renewal/trial/refunds.                     | source_verified; product/legal/store review required |
| Eligibility/consumer rights | No age, guardian, terms-acceptance or notice flow is enforced. | Terms not yet reviewed            | `/terms` not yet reviewed               | Do not fill gaps with assumptions.                       | **release blocker**                                  |

## Release gates and maintenance

1. **Product owner:** confirm stores/offers, account age/guardian rule, participant/login model and a real change-notice channel.
2. **Legal reviewer:** approve lawful bases, third-party/child handling, consumer terms, retention exceptions and transfers.
3. **Platform/provider owner:** provide redacted evidence for hosting/backups, OpenAI, Google OAuth, RevenueCat, Sentry, support and web analytics/cookies.
4. **Release owner:** verify public URLs render from an independent network (DNS resolution failed in this environment on 2026-09-17, which is not deployment evidence), test mailto composition without sending a request, reconcile legal versions and complete Google Play Data Safety. Prepare a separate iOS App Privacy review only from the actual iOS build and backup behavior.

For every new flow, record people affected; exact categories; purpose; trigger and
controls; local/backend storage; recipient/transmitted subset; household
visibility; retention/deletion/backups; lawful-basis/transfer review; source,
test and deployment evidence; and accountable status. A public claim is
release-ready only when it has evidence, not merely policy text.

References: [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311) and [Google Play account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
