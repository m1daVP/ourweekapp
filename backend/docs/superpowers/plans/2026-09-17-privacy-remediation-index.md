# Privacy and Terms Review: Implementation Handoff

**Prepared:** 2026-09-17. **Scope:** six findings from the mobile privacy/terms review, including related API, website, and data-map changes. This handoff contains plans only; it does not approve new legal commitments, erase data, deploy changes, or change product behavior.

## Repository locations

- `API` = `D:/Projects/myself/weekly-us-api` (Fastify, PostgreSQL/Supabase, Vitest).
- `MOBILE` = `D:/Projects/myself/weekly-us` (Vue, Capacitor, Vitest).
- `LANDING` = `D:/Projects/myself/weekly-us-landing` (Astro).
- Paths in each plan use these aliases. Read each repository's applicable instructions before editing it.

## Plans and execution order

| Review finding | Plan | Order and dependency |
| --- | --- | --- |
| 1. Retention/deletion claims conflict with soft deletion | [01: Retention and erasure](2026-09-17-privacy-01-retention-erasure.md) | Highest priority; establishes retention language consumed by other plans |
| 2. AI and Calendar disclosures lack detail | [02: Integration disclosures](2026-09-17-privacy-02-integrations.md) | Can start evidence collection immediately; coordinate Calendar deletion with 01 |
| 3. Diagnostics disclosure is vague | [03: Diagnostics](2026-09-17-privacy-03-diagnostics.md) | Independently investigate and implement |
| 4. Policy does not explain local deletion | [04: Local deletion](2026-09-17-privacy-04-local-deletion.md) | Independently document current device behavior; use 01 for backend wording |
| 5. Terms lack consumer/eligibility detail | [05: Terms](2026-09-17-privacy-05-terms.md) | Draft now; finalize after product/legal decisions and 01 |
| 6. Data map is stale | [06: Data map and release reconciliation](2026-09-17-privacy-06-data-map.md) | Baseline first, final reconciliation last |

Recommended sequence: 06 Task 1 → 01 → 02/03/04/05 → remaining 06 tasks. Tasks may be implemented separately, but all share the legal content files. Assign a single editor or integrate sequentially to avoid overwriting clauses.

## Corrections and qualifications to the review

- Account restoration is deliberate: `API/docs/account-restoration.md`, `API/scripts/restore-deleted-account.ts`, and its RPC/tests exist. Do not silently remove it or invent a grace period.
- The mobile account-deletion confirmation already lists private notes, settings, and local backups. Plan 04 aligns policy and verifies behavior; it does not require building a new deletion flow.
- Legal pages intentionally render canonical English for English, Ukrainian, and Spanish app locales. Existing tests establish this choice. Localize actionable dialogs; a legal translation project is separate unless authorized.
- Sentry is initialized when its DSN is configured. Whether the production DSN and provider retention settings are configured was not verified. SDK defaults must be checked against the installed version.
- Website source repeats 30/90-day claims. The live privacy and terms URLs could not be fetched during review; a fetch failure is not evidence that they are down.
- Existing tests asserting strings such as `30 days` prove rendered copy only, not erasure or backup expiry.

## Shared execution rules

1. Re-read files and inspect `git status` before work. Mobile currently has unrelated meeting-summary edits, including `messages.ts`; preserve those changes.
2. No staging, commits, pushes, deployments, production migrations, provider changes, or real-user deletion are authorized by this planning request.
3. Do not edit existing applied migrations. Use new timestamped migrations, service-role-only functions, explicit ownership checks, and local/staging data fixtures.
4. Do not claim legal compliance, zero AI retention, absence of all personal data in diagnostics, guaranteed backup expiry, or production rollout from source code alone.
5. Continue independent work while collecting missing facts. A blocked legal or production decision blocks only dependent finalization, not research, tests, or draft preparation. Label drafts as drafts in internal documents, never publish guesses.
6. Where a plan introduces a function/type, it is a proposed interface, not an assertion that it exists today. Follow existing conventions and update all callers/tests together if refined.
7. The writing-plans header names optional execution skills. If those skills are unavailable, execute checkboxes directly. It does not authorize creating user-owned tasks or require subagents.
8. Documentation-only work: review links/content; no full runtime suite required. Runtime work: run focused regressions plus the repository's required checks. Record skipped integration tests explicitly.

## Information the implementation agent must obtain

| Topic | Required evidence | Why it is needed |
| --- | --- | --- |
| Erasure vs restoration | Owner decision on when a verified deletion request becomes irreversible and any disclosed grace period | Current restoration and unconditional deletion copy conflict |
| Retention | Actual active-data, support, billing, logs, provider, backup lifetimes and start events; exceptional legal holds | A number without a mechanism is not a commitment the app can substantiate |
| Infrastructure | Supabase/hosting region, backup/PITR/manual export settings, scheduler and worker deployment | Source does not establish deployed behavior |
| Provider contracts/settings | OpenAI, Google, Sentry, RevenueCat and store configuration; transfer safeguards | Required to describe actual recipients, retention, and international processing |
| Terms/product | Intended minimum account age, child profile behavior, supported stores, renewal/trial rules, notice process | Do not invent account restrictions or commercial promises |
| Legal review | Purpose-to-lawful-basis mapping, special-category/third-party information treatment, consumer terms | Engineering can establish facts; final legal classifications need review |

## Completion report expected from each agent

- Files changed and behavior/documentation changed.
- Tests run, actual results, and any skipped DB/device/provider checks.
- Evidence for each production/legal statement and remaining decisions with their impact.
- Migration rollout and recovery instructions if applicable.
- No claim that the app is ready to release until all six acceptance sections and production checks are complete.

## Official sources to re-check during implementation

- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [Google Workspace API user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
- [GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [EU distance-selling guidance](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm)
- [EU digital contract rules](https://commission.europa.eu/topics/business-and-industry/contract-rules/digital-contracts/digital-contract-rules_en)

Check current provider documentation before new provider-specific assertions; distinguish legal duties from recommended product improvements.
