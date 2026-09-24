# Consumer Terms and Account Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Make subscription, eligibility, change-notice and consumer-rights language understandable and consistent with the product and applicable reviewed legal position.

**Architecture:** Draft changes against verified commercial/account behavior, obtain decisions for missing product/legal facts, then update the existing mobile and website terms in one coordinated revision. This plan does not invent a billing engine, age-verification system, or consent database.

**Tech Stack:** Vue legal content, Astro website, TypeScript/Vitest; RevenueCat/app-store integration as evidence.

## Global Constraints

- Read the [index](2026-09-17-privacy-remediation-index.md). Draft legal copy is not legal approval.
- Do not assume everyone must be 18, that all minors require identical consent, or that a participant profile is a login account.
- Do not automatically waive statutory withdrawal rights when a subscription starts or claim store refunds exhaust all consumer remedies.
- Do not promise notice periods, refund amounts, trial terms or store availability without confirmed implementation and legal review.

## File map

- `MOBILE/src/features/legal/productionLegalContent.ts`: existing terms and privacy notice acknowledgement wording.
- `MOBILE/src/features/legal/productionLegalContent.test.ts`, `MOBILE/src/pages/__tests__/LegalPages.test.ts`: rendered/legal-content regressions.
- `MOBILE/src/pages/TermsPage.vue`, `PrivacyPolicyPage.vue`: link and readability behavior if copy needs links.
- `MOBILE/src/features/subscription/`, `MOBILE/src/features/auth/`, `MOBILE/src/features/participants/`: read actual purchase/manage, signup and child-profile behavior. Locate exact files with `rg --files` before assigning runtime edits; this plan authorizes no speculative eligibility enforcement.
- `API/src/modules/billing/`, `API/src/modules/auth/`: read entitlement/signup behavior and current role constraints.
- `LANDING/src/pages/terms.astro`, `privacy.astro`, `delete-account.astro`; `LANDING/ourweek-terms-of-service.md`, `ourweek-privacy-policy.md`: establish whether root Markdown files are maintained sources or historical drafts.
- Create `MOBILE/docs/terms-review-decisions.md`: proposed wording, source evidence, owner/legal decisions and publication status.

### Task 1: Confirm the product facts and decision boundaries

- [ ] Inventory supported production stores, subscription period(s), automatic renewal, trials, grace/billing retry behavior, cancellation management link, entitlement expiry, refund routing and account deletion. Verify current store-configured terms rather than hardcoding sample product settings.
- [ ] Record who may create an account, who may join a household, and how child participants are represented. Obtain an explicit minimum-age/guardian policy decision. If that decision requires runtime signup changes, write a focused follow-on implementation task before enforcing it; do not collect date of birth solely to fill a policy gap.
- [ ] Ask the owner to confirm how material changes, price changes, service discontinuation, suspension and termination are communicated. Draft a workable notice process tied to actual available channels, with emergency/security exceptions reviewed separately.
- [ ] Identify whether the existing signup makes terms available before registration and whether links work signed out. Distinguish accepting contractual terms from acknowledging a privacy notice; blanket agreement to a policy does not establish consent for every processing purpose.
- [ ] Obtain current Polish/EU consumer review for withdrawal, faulty digital-service remedies, complaints handling, material modifications and any mandatory notice requirements. Use official sources from the index; do not import a generic US arbitration/waiver template.

### Task 2: Prepare a clause-by-clause draft

**Interface:** retain the existing `LegalDocument`/`LegalSection` structure. Add or revise sections rather than scattering terms into billing components.

- [ ] Write `Eligibility and household participants` using the selected age/guardian rule and explaining participant profiles are not automatically independent accounts. Add privacy treatment for participant data entered by others, including children, without pretending a contractual checkbox solves all third-party-data duties.
- [ ] Expand `Subscriptions and payments` with automatic renewal, billing interval/price presentation, how to cancel future renewal, normal access through the paid period subject to confirmed refund/revocation rules, and deletion not cancelling store billing.
- [ ] Include this draft consumer-rights safeguard for legal review:

```text
App-store payment and refund procedures do not limit mandatory consumer
rights that apply to you. You may also have rights concerning withdrawal
from a distance contract and remedies if the service does not meet legal
requirements. Contact us at ourweekapp@gmail.com for service complaints.
```

- [ ] Supplement that safeguard with the reviewed practical procedure and time limits applicable to this service. A vague rights reservation alone does not replace required pre-contract information.
- [ ] Revise the unrestricted feature-change sentence to describe legitimate reasons, notice, and applicable cancellation/remedy rights for material adverse changes to paid service. Do not assert a working notice mechanism before Task 1 confirms it.
- [ ] Clarify suspension/termination triggers, proportionality, notices/recourse where applicable, and how users request an export/deletion. Use Plan 01 for retention language; avoid duplicating a second inconsistent numeric promise in terms if a clear privacy cross-reference suffices.
- [ ] Preserve useful existing provisions: household access, acceptable use, AI review warning, no professional/emergency advice, Polish law with mandatory residence-country consumer protections.
- [ ] Do not add broad content licensing, liability exclusions, or promises of encryption unrelated to the findings. Route any necessary additional legal clause through explicit review.

### Task 3: Implement the reviewed revision and verify access

- [ ] Apply the reviewed content to mobile and landing together; preserve the confirmed controller identity and contact details. Resolve root Markdown status so a later release cannot republish stale terms.
- [ ] Record the review/version and actual effective date in the decision document. If publication is not yet approved, keep the draft internal and clearly report that the public copy was not finalized.
- [ ] Replace `By using OurWeek, you agree to these terms and the Privacy Policy` with a reviewed separation of contractual acceptance and privacy information; preserve separate feature confirmations where needed.
- [ ] Extend content tests with a section-level smoke test, for example:

```ts
it('explains eligibility and consumer rights', () => {
  const headings = termsOfService.sections.map((section) => section.heading);
  expect(headings).toContain('Eligibility and household participants');
  expect(headings).toContain('Consumer rights and complaints');
});
```

- [ ] Test signed-out access to terms/privacy from signup and paywall if routes or links changed. Verify canonical English remains intentional in all three app locales; keep action/confirmation labels localized.
- [ ] Run mobile legal/page tests. If mobile source changes, run `npm run build` and `npm run check`; if landing source changes, run its `npm run build`. Do not add snapshot tests that substitute for legal review.
- [ ] Manually read on a narrow viewport and verify subscription-management and contact links work. Update Plan 06 with approved eligibility/store/notice facts and unresolved decisions.

**Acceptance:** clear purchase/cancellation/deletion distinctions; no blanket waiver of mandatory rights; explicit reviewed account eligibility; workable change/termination procedure; matching mobile/web versions. If legal/product inputs are missing, deliver the complete draft and decision list without claiming it is approved or publishing assumptions.
