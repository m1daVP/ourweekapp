# AI Release Checklist

Created: 2026-09-03.

Purpose: track the steps from [AI_READINESS_REVIEW.md](AI_READINESS_REVIEW.md) through a verified first-user release. These are follow-up tasks, not completed implementation. No checkbox is pre-completed from the review alone.

## Working constraints

- Preserve workspace authorization, adult-only generation, private-note exclusion, and stable mobile API contracts.
- Keep provider keys, raw provider errors, and meeting content out of client responses and logs.
- Add a failing regression test before each behavioral fix; confirm it fails for the intended reason, then implement and rerun it.
- Use new, focused migrations; never edit already-applied migrations. Test database behavior locally and on staging before deployment.
- Do not use production data or credentials in automated tests.
- Database transactions must not span the external OpenAI request.
- Keep existing summaries readable while restricting new generation according to allowance.
- This checklist does not authorize purchases, production configuration changes, deployment, or Git staging/commits/pushes. Obtain the required authorization separately.
- Backend paths are relative to this root. Mobile paths below are relative to `../weekly-us/`.

## Phase 1: Confirm provider availability and improve diagnosis

### 1. Restore and verify the provider configuration (AI-01)

- [ ] Confirm the OpenAI organization/project and credential used by the deployed backend without exposing the key.
- [ ] Have the account owner resolve the exhausted credit balance or quota configuration.
- [ ] Verify `AI_PROVIDER`, `AI_API_KEY`, and effective models in staging and production configuration.
- [ ] Run a minimal synthetic staging generation after provider availability is restored.
- [ ] Document a preflight procedure in `docs/deployment.md` and an operator response for quota/auth/model failures.
- [ ] Ensure AI is not advertised as available when configuration is absent; decide whether this is a deployment gate or explicit feature availability state.

Acceptance: a staging request completes with valid output, token usage, and a traceable request ID. No real meeting data or secrets are used in the smoke test.

### 2. Classify provider failures and protect logs (AI-08)

Files: `src/modules/ai/openai.client.ts`, `src/modules/ai/ai.service.ts`, `tests/openai.client.test.ts`, `tests/ai.service.test.ts`.

- [ ] Add provider fixtures for successful output, quota/auth/model errors, transient rate limiting, timeout/network failure, refusal, incomplete response, and invalid JSON/schema output.
- [ ] Make the tests assert safe classification and absence of raw prompt/key/provider-body data in logs and mobile responses.
- [ ] Inspect response status and structured error/refusal/incomplete information before parsing `output_text`.
- [ ] Record safe provider request ID, status/code/class, effective model, duration, and available usage metadata.
- [ ] Preserve stable client error codes; retry only genuinely retryable failures within the mobile timeout budget.
- [ ] Verify the configured SDK timeout/retry budget remains below the mobile abort timeout, including database work.
- [ ] Connect quota/auth/configuration failures to an actionable operator alert without logging sensitive content.

Acceptance: an operator can distinguish quota exhaustion from timeout or invalid output without inspecting private meeting data. Each error fixture has a passing regression test.

## Phase 2: Make server-side generation and accounting reliable

### 3. Deduplicate concurrent generation (AI-05)

Files: `src/modules/ai/ai.service.ts`, `src/modules/ai/ai.repository.ts`, `tests/ai.service.test.ts`; add a new migration and database integration tests for the chosen atomic request operation.

- [ ] Define the active generation key using workspace, meeting, and input hash, retaining model/prompt/input changes in that hash.
- [ ] Write a concurrency test where two identical requests arrive before either provider call completes.
- [ ] Implement atomic claim/get-or-create behavior so only one request owns generation for that input.
- [ ] Define a stable response for a duplicate still in progress and a cached response for completed work.
- [ ] Ensure failed attempts can be retried without bypassing allowance or creating duplicate settled credits.
- [ ] Check that cached output actually belongs to the matching generation input, rather than relying solely on the current meeting summary field.
- [ ] Test different workspaces and different inputs independently to avoid accidental cross-workspace deduplication.

Acceptance: concurrent identical input causes one provider call and one settled credit. Retrying a completed request returns the same persisted result without a new credit charge.

### 4. Recover abandoned reservations before checking allowance (AI-06)

Files: `src/modules/ai/ai.service.ts`, `src/modules/assistant/assistant.repository.ts`; add a new migration instead of editing `20260829120000_add_recap_allowances_and_member_caps.sql`.

- [ ] Reproduce Free allowance exhausted entirely by reservations older than 15 minutes.
- [ ] Reproduce the same case for a Premium period, alongside active and settled reservations.
- [ ] Move cleanup into an operation reachable before allowance rejection, or combine cleanup, availability, and reservation atomically.
- [ ] Ensure displayed allowance and generation use the same stale-reservation policy.
- [ ] Define idempotent recovery of abandoned pending AI requests and preserve the history needed for diagnosis.
- [ ] Verify cleanup never releases active requests or settled credits and respects workspace/period boundaries.

Acceptance: a process interruption cannot permanently consume all Free credits. Availability recovers after the timeout, and repeated recovery calls do not change correct accounting.

Implementation update, 2026-09-04: automated migration/repository/service coverage is implemented and passing, including Free/Premium status ordering, generation claim ordering, recovery failure handling, and service-role migration constraints. The full backend suite, typecheck, and build pass. The isolated-local database integration test is intentionally skipped without local Supabase credentials, so the reproduction, database-state, staging, and manual acceptance checks above remain open.

### 5. Finalize summary, audit record, and credit atomically (AI-07)

Files: `src/modules/ai/ai.service.ts`, `src/modules/ai/ai.repository.ts`, `src/modules/meetings/meetings.repository.ts`, `src/modules/assistant/assistant.repository.ts`; add a new transaction/RPC migration and integration tests.

- [ ] Add fault-injection cases for failure after provider success and during each persistence step.
- [ ] Define one database finalization operation that saves the summary, completes the request with usage metadata, and settles the reservation together.
- [ ] Make finalization idempotent so a retry after an uncertain database response cannot charge twice.
- [ ] Validate the meeting/input revision before attaching generated output; define safe behavior when the meeting changed during generation.
- [ ] Keep the network provider call outside the database transaction.
- [ ] Preserve the original failure if release/audit cleanup also fails; log cleanup failures separately and safely.
- [ ] Verify interrupted operations converge through the recovery path from step 4.

Acceptance: no saved-success result is paired with a failed request and released credit. A failed transaction leaves a recoverable, internally consistent state.

Implementation update, 2026-09-04: automated migration/repository/service coverage is implemented and passing, covering atomic finalization invocation, token/cache persistence contract, idempotent completed retries, revision-conflict rollback, uncertain finalization handling, and cleanup-failure error preservation. The full backend suite, typecheck, and build pass. The isolated-local-Supabase finalization integration test is intentionally skipped without local credentials; migration execution, database-state proof, staging, manual interruption, and release acceptance checks above remain open.

## Phase 3: Repair the mobile/server contract

### 6. Synchronize completion before generation and apply the server revision (AI-02)

Backend files: `src/modules/ai/ai.schema.ts`, `src/modules/ai/ai.service.ts`, AI route/service tests, and OpenAPI output.

Mobile files: `src/features/meeting/composables/useMeetingSession.ts`, `src/features/meeting/aiSummaryService.ts`, `src/shared/api/aiApi.ts`, `src/app/stores/meetings.ts`, `src/shared/services/syncService.ts`, `src/shared/services/syncMergeService.ts`.

- [x] Add a test where meeting completion has not yet synchronized and prove generation currently runs too soon.
- [x] Explicitly await a successful completion sync; verify the server has the completed meeting before requesting AI.
- [x] Handle offline or failed synchronization without losing the locally completed meeting.
- [x] Add a backward-compatible response containing the authoritative updated meeting or its revision/timestamp metadata.
- [x] Apply that server state on the client without manufacturing a new local edit solely to store server-generated output.
- [x] Add a test that generates a summary and immediately synchronizes again without a revision conflict.
- [x] Test a genuine concurrent edit separately so the fix does not suppress legitimate conflicts.
- [x] Regenerate/check OpenAPI and update mobile DTOs together.

Acceptance: finish -> sync -> generate -> apply server state -> sync succeeds on slow networks. AI failure does not undo meeting completion.

Implementation verification, 2026-09-03: backend 51 suites/376 tests passed; mobile 59 suites/444 tests passed; backend typecheck/build/OpenAPI check passed; mobile production build passed. Real-device/slow-network QA and backend-first deployment remain pending. The explicit mobile app TypeScript check and project-wide format check still report unrelated pre-existing baseline issues documented in the implementation result.

### 7. Carry recap allowance through every subscription and generation path (AI-03)

Mobile files: `src/features/subscription/types.ts`, `src/features/subscription/services/backendSubscriptionProvider.ts`, `src/app/stores/subscription.ts`, `src/pages/MeetingSummaryPage.vue`, `src/pages/MeetingDetailsPage.vue`, `src/features/meeting/composables/useMeetingSession.ts`.

- [x] Add mapping tests for Free with 3 remaining, Free exhausted, Premium with allowance, Premium exhausted, and viewer role.
- [x] Define `assistantRecap` in the subscription snapshot contract and populate the field the store actually reads.
- [x] Replace Premium-only generation gates with the server-provided recap permission in every entry point.
- [x] Refresh allowance after successful generation and after an exhaustion response.
- [x] Define a safe loading/unavailable state when allowance has not been fetched; do not imply unlimited availability.
- [x] Run the actual mobile app TypeScript configuration and remove the `assistantRecap` type errors.

Acceptance: eligible Free adults can use their starter credits; exhausted users and viewers cannot generate; every screen shows the same allowance.

Implementation verification, 2026-09-04: 64 mobile suites/520 tests passed; production build passed; all changed files pass targeted formatting. The explicit app typecheck still reports the unrelated baseline, but no missing `assistantRecap` contract errors. Project-wide `check` stops on 16 unrelated formatting files; targeted lint reports only the pre-existing unused `meetingPreview` in `MeetingDetailsPage.vue:73`. Refresh requests during an in-flight billing action are retained until it settles. See the [design and results](docs/superpowers/specs/2026-09-04-ai-recap-allowance-design.md#implementation-result). No production/provider/device test or deployment was performed.

### 8. Separate historical read access from new generation access (AI-04)

Mobile files: `src/pages/MeetingSummaryPage.vue`, `src/pages/MeetingDetailsPage.vue`, associated page/component tests.

- [x] Add tests for reading and sharing an existing summary with zero remaining credits and after Premium expiry.
- [x] Render existing authorized summary content before evaluating generation availability.
- [x] Restrict only generation controls based on allowance; retain workspace access checks for historical content.
- [x] Verify consuming the final credit does not immediately lock the result that was just generated.

Acceptance: historical summaries remain readable/shareable after exhaustion or subscription expiry, but unauthorized workspace access stays blocked.

The checks above are automated implementation verification, not device or production release sign-off. Meeting access and paid export rules were not broadened. The manual scenarios later in this checklist remain outstanding.

## Phase 4: Complete pre-pilot safeguards

### 9. Preserve canonical commitments (AI-09)

- [ ] Add a display test where model output omits an actual task or changes an agreement.
- [ ] Render tasks and agreements from canonical meeting/task records in `src/pages/MeetingSummaryPage.vue` in the mobile project.
- [ ] Keep generated narrative supplemental; require confirmation before applying any AI-suggested commitment changes.
- [ ] Verify shared/exported recap text does not silently substitute AI commitments for actual records.

Acceptance: AI omission or hallucination cannot replace what the household actually recorded.

### 10. Make model selection explicit and versioned (AI-10)

- [ ] Define precedence between global `AI_MODEL`, template-specific configuration, and defaults in `src/modules/ai/summary-prompts.ts`.
- [ ] Add model-resolution tests for all six known templates and an unknown template.
- [ ] Persist effective model and prompt version on each request using a backward-compatible new migration.
- [ ] Decide whether to pin model snapshots based on the staging evaluation; document the choice.
- [ ] Update `.env.example` and deployment docs so operators can predict the effective model.
- [ ] Evaluate the 800-token output cap with each model, including reasoning usage and incomplete responses.

Acceptance: logs/audit data identify what generated a recap, and configuration changes select the documented model.

### 11. Validate model-generated owner references (AI-11)

- [ ] Add service tests for an unknown participant ID, another workspace's participant ID, and a valid meeting participant.
- [ ] Validate generated task owner IDs against the authorized meeting participants before persistence.
- [ ] Choose and document a safe invalid-reference outcome, such as unassigned output or a controlled validation failure; never guess an owner.

Acceptance: no saved AI task references a participant outside the authorized meeting.

### 12. Reconcile limits and entitlement freshness (AI-12, AI-13)

- [x] Adopt and document the user-selected hourly anti-abuse policy: 5/user and 20/workspace in a rolling hour.
- [x] Keep recap charging separate: cache hits and pending duplicates create no slot or credit; failed provider/persistence work is released and marked failed, so it does not continue to count.
- [x] Add focused migration, repository, and service coverage for user/workspace rate-limit results, exact reset propagation, role ordering, and workspace-scoped atomic claims.
- [x] Apply the trusted subscription freshness policy to both status and generation.
- [x] Add AI/service coverage for fresh Premium, stale Premium, expiry, and missing-subscription Free fallback; Premium usage remains scoped to the exact current expiry period.
- [x] Update the allowance design and implementation documentation to the 5/20 policy.
- [ ] Run the guarded local-Supabase boundary/concurrency integration suite after applying migrations locally, then repeat the boundary, stale-Premium, expiry, and renewal checks in staging.

Implementation verification, 2026-09-05: focused AI-12/AI-13 coverage passed (86 tests; 4 guarded local-Supabase tests skipped without local credentials). The complete backend suite passed (451 tests; 7 guarded local tests skipped), as did typecheck, build, and OpenAPI validation. No migration was applied and no staging/provider test was performed.

Acceptance: the mobile allowance, API enforcement, billing trust policy, and documented limits agree.

### 13. Provide specific mobile recovery states (AI-14)

- [ ] Test allowance exhaustion separately from hourly anti-abuse rate limiting in `src/features/meeting/__tests__/aiSummaryService.test.ts` in the mobile project.
- [ ] Add distinct handling for unsynced meeting, provider outage, timeout/offline, and retryable revision conflict.
- [ ] Preserve the completed meeting and expose a deliberate retry when safe; avoid automatic retry loops or duplicate generation.
- [ ] Localize remaining-credit and renewal-date copy for every supported locale.
- [ ] Include a safe correlation identifier in support diagnostics where available.

Acceptance: users know whether to sync, retry later, or wait for allowance renewal without seeing internal provider details.

### 14. Review privacy and abuse attribution (AI-15, AI-16)

- [ ] Define a backend-owned, stable hashed `safety_identifier` and ensure it does not expose raw user identifiers or email addresses.
- [ ] Test that private notes remain excluded and that raw meeting content never enters error logs.
- [ ] Confirm the first-use disclosure and automatic-generation behavior clearly explain when shared meeting data is sent to OpenAI.
- [ ] Verify provider data-handling terms and application privacy disclosures; do not equate `store: false` with a complete retention guarantee.
- [ ] Define the response policy for unsafe/refused content in this family/couple context and include it in quality review.

Acceptance: provider attribution is privacy-preserving, data transmission is understandable to users, and tested privacy boundaries remain intact.

### 15. Run a representative model evaluation (AI-16)

- [ ] Prepare synthetic/anonymized examples for `weekly-family-check-in`, `family-with-kids`, `money-check-in`, `busy-week-planning`, `couple-reset`, and `conflict-cleanup`.
- [ ] Cover every supported locale, minimal content, contradictions, missing owners/dates, large input, and unresolved topics.
- [ ] Include prompt injection in notes/names/section text and sensitive family/child/health content.
- [ ] Record model/prompt version, latency, token usage, refusals, factual omissions, invented commitments, and owner/date accuracy.
- [ ] Define measurable pilot acceptance thresholds before judging the evaluation results.
- [ ] Review failures, adjust prompts/configuration where justified, and rerun the affected cases.
- [ ] Confirm each template successfully completes in funded staging through the real mobile-to-backend flow.

Acceptance: the evaluation record supports the chosen model/prompt configuration and contains no unresolved critical factual/privacy failure.

## Phase 5: Verification and release sign-off

### Automated checks

- [ ] Update stale AI route authorization tests to reflect service-owned authorization and Free starter credits. Retain real denial coverage for viewers and unauthorized workspaces.
- [ ] Investigate backend suite hook timeouts; do not hide them by disabling tests.
- [ ] Run focused backend tests, then the full suite, typecheck, build, and OpenAPI validation.

Run from the backend root:

```powershell
npm run typecheck
npm test -- tests/openai.client.test.ts tests/ai.service.test.ts tests/ai.summary-payload.test.ts tests/ai.routes.test.ts
npm test
npm run build
npm run openapi:check
```

- [ ] Run mobile unit/contract tests and an explicit app TypeScript check. Resolve release-blocking type errors rather than relying on the root project-reference invocation.

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npm run build
```

The `ignoreDeprecations` argument matches the reviewed TypeScript 6 toolchain; it does not suppress application type errors. Revisit it if the toolchain changes.

- [ ] Run local database migration and integration checks against an isolated test database, including concurrent generation, stale recovery, and failed finalization.
- [ ] Review new migrations for RLS, workspace ownership, locking, compatibility, and recovery/rollback behavior.
- [ ] Apply/test migrations in staging before any code that requires them; follow the project's authorized deployment process.

### Manual release scenarios

- [ ] Adult Free user generates the first, second, and third recap; the fourth is blocked with accurate allowance copy.
- [ ] Premium allowance renews at the correct period boundary; exhausted allowance does not hide historical recaps.
- [ ] Viewer and cross-workspace generation requests are rejected.
- [ ] Two devices request the same recap concurrently: one provider call and one credit charge.
- [ ] Finishing a meeting on a slow connection synchronizes completion before generation.
- [ ] Offline finish preserves the meeting and offers generation only after successful synchronization.
- [ ] A successful generation followed by sync produces no AI-only revision conflict.
- [ ] Timeout, quota outage, refusal, and incomplete output produce safe, distinct outcomes without lost meetings or incorrect charges.
- [ ] Simulated process interruption recovers abandoned reservations and pending requests.
- [ ] Actual tasks/agreements remain authoritative in display and share text.
- [ ] Private notes are absent from provider payloads and logs.

### Final go/no-go

- [ ] AI-01 through AI-08 are resolved with linked verification evidence.
- [ ] AI-09 through AI-16 are completed or have explicitly accepted, documented pilot limitations.
- [ ] Backend and mobile release checks are green; required database integration tests pass.
- [ ] Funded staging evaluation passes for all templates and supported locales.
- [ ] Provider quota/error alerts and a support/recovery procedure are in place.
- [ ] Deployment authorization, migration ordering, and rollback/forward-fix procedure are confirmed.
- [ ] Record the release decision, date, deployed revisions, effective models/prompt versions, and accepted limitations in this file before inviting users.
