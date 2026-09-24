# Privacy release checklist

**Created:** 2026-09-17
**Purpose:** reconcile source facts with in-app copy, landing pages and store
submissions. This is a release gate, not a declaration that any environment is
ready for release.

## Evidence record

| Surface                 | Source checked                                                                                               | Deployment check                 | Result                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| In-app legal pages      | `src/features/legal/productionLegalContent.ts`, `src/pages/TermsPage.vue`, `src/pages/PrivacyPolicyPage.vue` | Not performed                    | Source references canonical mobile legal content.                                                                                              |
| Landing legal pages     | `src/pages/privacy.astro`, `src/pages/terms.astro`, `src/pages/delete-account.astro`                         | HTTP `HEAD` attempted 2026-09-17 | DNS could not resolve `ourweekapp.com` from this execution environment; this does not prove the site is unavailable.                           |
| Root legal Markdown     | `ourweek-privacy-policy.md`, `ourweek-terms-of-service.md`                                                   | Not applicable                   | Untracked historical waitlist drafts with placeholders; no Astro source imports them.                                                          |
| Public deletion contact | `src/pages/delete-account.astro`                                                                             | Mailto not sent                  | `mailto:ourweekapp@gmail.com?subject=OurWeek%20account%20deletion%20request` is source-verified. Device/browser behavior still needs checking. |

## Reconciliation table

| Claim                       | Source fact                                                                                   | Mobile location                         | Website location                        | Store declaration mapping                                         | Evidence / date                  | Status                                 |
| --------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- | -------------------------------- | -------------------------------------- |
| Controller/contact          | Operator and support email are in legal source.                                               | `productionLegalContent.ts`             | `/privacy`, `/terms`, `/delete-account` | Match developer account identity/contact.                         | Source review, 2026-09-17        | Needs deployment/release confirmation. |
| Shared sync/visibility      | Shared meeting and participant data is workspace scoped.                                      | Privacy policy                          | `/privacy`, `/terms`                    | Assess personal information/user-content categories.              | API/mobile source review         | Legal/store mapping required.          |
| Private notes               | Local app data, excluded from normal AI/export paths.                                         | Privacy policy                          | `/privacy`                              | Assess device backups and SDKs before declaring uncollected.      | Storage/AI source review         | Needs platform evidence.               |
| AI recap                    | Selected shared content goes to OpenAI only when requested.                                   | Privacy policy and recap disclosure     | `/privacy`                              | Assess collection/sharing by app and provider.                    | API/mobile source review         | Needs provider/store evidence.         |
| Google Calendar             | Optional connect/sync/disconnect operations exist.                                            | Privacy policy                          | `/privacy`                              | Assess Calendar/account data and scopes.                          | Calendar source review           | Needs Google Cloud evidence.           |
| Automatic diagnostics       | Sentry is conditional on DSN and filters event data.                                          | Privacy policy                          | `/privacy`                              | Include SDK if enabled in submitted build.                        | Diagnostics evidence, 2026-09-17 | Needs deployed settings/legal review.  |
| Erasure/backups             | API soft-deletes and supports restoration.                                                    | Existing 30/90-day copy is unsupported. | Existing 30/90-day copy is unsupported. | Do not represent freezing as completed deletion.                  | Retention runbook, 2026-09-17    | **Blocks release.**                    |
| Local cleanup               | Requesting-device cleanup is attempted/retryable; other devices/backups need separate action. | Privacy policy                          | `/privacy`, `/delete-account`           | Confirm native/backup behavior.                                   | Mobile source, 2026-09-17        | Needs device/backup verification.      |
| Subscription cancellation   | Account deletion does not cancel store billing.                                               | Terms                                   | `/terms`, `/delete-account`             | Verify products, price, renewal, trial, grace and refund process. | Billing source, 2026-09-17       | **Blocks terms finalization.**         |
| Consumer rights/eligibility | No age/guardian/terms acceptance/change-notice flow is implemented.                           | Terms not reviewed                      | `/terms` not reviewed                   | Do not submit assumptions.                                        | `docs/terms-review-decisions.md` | **Blocks terms finalization.**         |

## Release-owner checklist

- [ ] Confirm deployed privacy, terms and deletion URLs render from an independent network; record date, HTTP result and effective date.
- [ ] Confirm Google Play developer identity/contact matches the public policy.
- [ ] Complete Google Play Data Safety and Data deletion responses from provider/account evidence, including SDK behavior. Do not equate server processing with device-only processing.
- [ ] If iOS ships, complete a separate Apple App Privacy review from the actual iOS build, SDK list and backup behavior.
- [ ] Obtain production evidence for hosting/Supabase region, backups/PITR, OpenAI, Google OAuth scopes, RevenueCat products and Sentry retention/access settings.
- [ ] Obtain legal approval for lawful bases, child/third-party information, transfers, retention/deletion exceptions, consumer rights and terms.
- [ ] Implement and verify irreversible erasure or an explicitly disclosed, approved restoration lifecycle before retaining a public deletion deadline.
- [ ] Confirm effective dates and version language match the approved legal release.

## Official references

- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [EU distance-selling guidance](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm)
- [EU digital contract rules](https://commission.europa.eu/topics/business-and-industry/contract-rules/digital-contracts/digital-contract-rules_en)
