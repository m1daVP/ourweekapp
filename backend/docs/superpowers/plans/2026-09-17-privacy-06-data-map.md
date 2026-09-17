# Privacy Data Map and Release Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Make the data map an evidence-based engineering reference that reliably drives mobile/web disclosures and store declarations.

**Architecture:** Keep `MOBILE/docs/privacy-data-map.md` as the canonical map, add a compact release cross-check document, and use per-flow source/test/config evidence. Separate implemented code from deployment facts, proposed policy decisions, and historical plans.

**Tech Stack:** Markdown documentation, repository/source review; relevant existing tests as evidence, not a new compliance framework.

## Global Constraints

- Read the [index](2026-09-17-privacy-remediation-index.md). This plan can start before the other five but finishes after their results are reconciled.
- Do not replace unknown production facts with inferred values or mark every old open decision resolved because code exists.
- No live store declaration submission, deployments, or generated `AGENTS.md` edits are authorized.
- No full runtime suite for documentation-only edits; no fabricated test results.

## Files

- Modify `MOBILE/docs/privacy-data-map.md` as the canonical inventory.
- Create `MOBILE/docs/privacy-release-checklist.md` for public-copy/store/config reconciliation and dated evidence.
- Read `MOBILE/docs/android-mvp-release-readiness.md`, mobile legal content/pages/tests, and all evidence/runbook outputs from Plans 01–05.
- Read `API/src/routes/v1.routes.ts`, domain schemas/repositories, migrations and tests. Prefer the versioned generated API contract if available; `http://localhost:3030/openapi.json` alone is not a reproducible source reference.
- Read landing privacy/terms/deletion source plus maintained root legal Markdown.
- If a documented project rule is stale and needs updating, edit its source file and regenerate according to that repository's instructions; do not edit generated instructions directly.

### Task 1: Establish a current baseline before remediation

- [ ] Add `Last reviewed: 2026-09-17` for this baseline and record actual repository revision/dirty-state evidence during execution. Do not invent SHAs or call a dirty checkout an exact deployed release.
- [ ] Replace the map's broad claim to represent production with a scope statement: source-verified behavior, production settings requiring confirmation, and the release being assessed.
- [ ] Introduce explicit status values:

```text
source_verified — implementation and referenced tests support the behavior
deployment_verified — redacted runtime/provider evidence confirms deployment
decision_required — an owner/legal choice is necessary before final wording
not_shipped — code or planned integration is not enabled in the assessed release
```

Allow multiple statuses when source is verified but deployment or policy is undecided.
- [ ] Retain the existing inventory domains, adding diagnostics/security logs, support email, provider-side records, backups, Google sign-in/auth identities where active, and participant information entered by other people. Inspect website processing too because the policy covers it; do not assume no hosting logs or forms.
- [ ] Correct known stale decisions: operator/contact/date already appear in legal content; OpenAI is implemented; Sentry is integrated conditionally; local cleanup is implemented; Calendar scopes/revocation code exists. Preserve verification questions about actual deployment, settings, legal decisions and provider contracts.
- [ ] Mark deletion as soft deletion plus access revocation in the current baseline, with restoration available, until Plan 01 actually changes and proves it. Do not document planned hard deletion as present behavior.

### Task 2: Expand each flow into a usable disclosure record

Use these fields for every flow; multiple small tables or subsections are preferable to one unreadably wide Markdown table:

```text
Data flow:
Source and people affected:
Exact categories and representative examples:
Purpose:
Required/optional trigger and user controls:
Local storage and backend storage:
Recipient and actual transmitted subset:
Household/member visibility:
Retention duration or documented criteria and start event:
Deletion, disconnection, backup, and external-copy behavior:
Lawful-basis review status:
Hosting/transfer safeguards evidence:
Source files, tests, and deployment evidence:
Verification status and unresolved decision owner:
```

- [ ] Populate all fields with facts or explicit unknowns such as `decision_required: operator must confirm the deployed Sentry retention setting; no verified duration yet`. This is an actionable unresolved fact, not a fabricated default.
- [ ] For private notes, separate local-only storage from device backup policy, local deletion, exports and AI exclusion. Avoid an encryption-at-rest promise unless the actual storage implementation supports it.
- [ ] For AI, distinguish OurWeek's retained summaries/audit data from OpenAI request/provider retention. Record payload fields, first-use control, and household visibility from Plan 02.
- [ ] For Calendar, distinguish Google sign-in from calendar authorization, actual scopes from actual operations, normal disconnect from account deletion, stored credentials from event copies in Google.
- [ ] For deletion, incorporate the approved lifecycle and exceptional retention from Plan 01, current-device cleanup from Plan 04, other devices and provider/backups. Record unresolved operational proof without weakening it to a vague promise.
- [ ] For diagnostics, use actual enabled categories and legal-basis review from Plan 03. Do not call automatic crash reporting a user-selected feature.
- [ ] Map processing purposes to the reviewed lawful basis instead of listing contract/consent/legitimate interest generically. Record sensitive household content and third-party/child participant data as questions requiring explicit legal treatment; ordinary acceptance of terms is not a universal basis.

### Task 3: Cross-check every public surface

- [ ] Add a checklist table with columns: claim, source fact, mobile location, website location, store declaration mapping, reviewer/evidence/date, status.
- [ ] Compare at least these claims: controller/contact, sync and shared visibility, private-note exclusions, AI inputs/provider/retention, Calendar scopes/disconnect, automatic diagnostics, account erasure timing, backup timing, local cleanup, shared data retention, subscription cancellation, consumer rights and eligibility.
- [ ] Read current Google Play Data Safety definitions before mapping collection/sharing/optional processing. Service-provider treatment under the store's terminology may differ from ordinary-language privacy-policy sharing; do not mark all backend-processed data as local-only.
- [ ] If an iOS release is in scope, prepare the corresponding App Privacy review based on actual iOS SDK/backup behavior; do not copy Android declarations without checking. No store submission in this task.
- [ ] Verify public privacy/terms/deletion URLs and contact route in a browser or HTTP check at execution time. Record actual response/rendering and test mail link composition without sending a real support request. Source existence is not proof of successful deployment.
- [ ] Resolve whether root landing Markdown legal files are canonical, maintained duplicates, or historical drafts. Explicitly label archival documents if appropriate; do not delete potentially user-maintained documents.
- [ ] Check effective dates and policy versions match across surfaces for the released revision. Do not change public dates solely to match this plan's date.

### Task 4: Review the documents and hand off release gates

- [ ] Validate all file links and official references. Search for stale phrases with targeted commands:

```powershell
rg -n 'Open Decisions|local cleanup decision|required.*signoff|whether.*diagnostics|AI provider|30 days|90 days|planned public v1' docs/privacy-data-map.md src/features/legal/productionLegalContent.ts
```

Each match requires contextual review, not blind replacement. Numeric promises may remain if actually verified.
- [ ] Read the final map against each of Plans 01–05. Every claim must have evidence or an explicitly assigned unresolved decision. Clearly distinguish “implementation complete” from “release verified.”
- [ ] Review Markdown formatting and all relative links. Skip full runtime tests for docs-only changes and say why; use results actually produced by code-changing plans as supporting evidence.
- [ ] Deliver a release checklist listing unresolved production/legal facts, the evidence needed to close them, and the person/system responsible. No item may be checked solely because policy text says it is true.

**Acceptance:** the map describes current facts rather than historical intentions; each public promise is traceable; contradictions across mobile/web/store material are resolved or visibly block release; another agent can update a data flow without rediscovering the system.
