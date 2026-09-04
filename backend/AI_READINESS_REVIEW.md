# AI Release Readiness Review

Review date: 2026-09-03.

Status: **Not ready for first users.** The backend foundation is sound, but mobile integration, generation reliability, credit recovery, and operational diagnostics need work before launch.

This document records the preceding read-only review. It does not mean the findings have been fixed or that verification has been rerun. Track follow-up work in [AI_RELEASE_CHECKLIST.md](AI_RELEASE_CHECKLIST.md).

## Scope and evidence

- Backend: `D:/Projects/myself/weekly-us-api`.
- Mobile app: `D:/Projects/myself/weekly-us`.
- Reviewed areas: environment configuration, API schemas/routes, authorization, provider adapter, prompts, payload privacy, persistence, caching, recap allowances, migrations, mobile generation/display/sync, and automated tests.
- Backend paths below are relative to this project root. Mobile paths are prefixed with `../weekly-us/`.
- Source locations describe the reviewed checkout and may move as fixes are implemented.
- Concurrency and crash-recovery findings are code-path analysis, not claims that those failures were reproduced against production.
- No production database migration or concurrency test was performed. The provider smoke test used synthetic content, not real meeting data.

## Launch blockers

### AI-01 [P0]: Provider credit balance prevents generation

The review's synthetic request reached OpenAI and returned `429 credit_balance_exhausted`. A configured key alone does not prove generation is available. Confirm the deployed credential/project matches the tested configuration before attributing this result to the deployed account.

Required outcome: restore provider availability, verify the deployed model configuration, and successfully generate a staging recap for every template. Add a quota/configuration alert and an operational preflight procedure.

Relevant files: `src/config/env.ts`, `src/modules/ai/openai.client.ts`, `render.yaml`, `docs/deployment.md`.

### AI-02 [P1]: Generation races meeting synchronization and leaves a stale revision

Implementation update, 2026-09-03: resolved in the current backend and mobile working trees. Completion is acknowledged before generation, writes are revision-guarded, and the mobile client applies authoritative revision/timestamp metadata. Automated backend/mobile tests and both builds pass. Deployment-order and real-device/slow-network verification remain release checks.

`finishMeeting()` updates local state and immediately calls generation in `../weekly-us/src/features/meeting/composables/useMeetingSession.ts` (around line 1197). Core sync is debounced by 1.5 seconds in `../weekly-us/src/shared/composables/useCoreDataSync.ts` (line 13). The API can therefore still see a draft/in-progress meeting and reject generation with `409`.

After generation, `src/modules/meetings/meetings.repository.ts` increments `serverRevision`, but the response does not give the mobile client the authoritative updated meeting. `../weekly-us/src/app/stores/meetings.ts` saves the summary and changes `updatedAt` without updating that revision. Timestamp-based merging can retain the stale local version and cause repeated sync conflicts.

Required outcome: await confirmed synchronization of meeting completion before generation; return/apply the authoritative meeting revision and timestamp after generation; ensure the next sync does not conflict solely because AI wrote the summary.

### AI-03 [P1]: Mobile subscription mapping drops Free recap allowance

Implementation update, 2026-09-04: resolved in the mobile working tree. Both subscription providers carry the top-level typed allowance; all three generation entry points and the shared coordinator use it without a Premium fallback. Refresh failures disable new generation without losing saved output, and late/reset responses are guarded. See the [implementation result](docs/superpowers/specs/2026-09-04-ai-recap-allowance-design.md#implementation-result). Device/staging verification remains pending.

`../weekly-us/src/features/subscription/services/backendSubscriptionProvider.ts` places `assistantRecap` inside the Premium entitlement, but omits it from the top-level subscription snapshot. `../weekly-us/src/app/stores/subscription.ts` reads `snapshot.assistantRecap` anyway. The direct app TypeScript check reports the mismatch.

Consequently the UI falls back to Premium feature access and Free users cannot use the backend's three starter recaps. Some generation entry points also still use `canUseFeature('aiSummary')` directly instead of recap allowance.

Required outcome: one typed allowance contract from API response through provider, store, and every generation entry point; refresh allowance after generation and on exhaustion responses.

### AI-04 [P1]: Exhausted generation allowance hides existing summaries

Implementation update, 2026-09-04: the approved saved-recap safeguard is implemented on both meeting pages and ordinary summary sharing. Existing meeting-access logic and independent export gates remain unchanged. Automated tests cover exhausted allowance, expired Premium resolved to Free, final-credit generation, and missing meetings. This does not change history policy or mark manual release QA complete.

`../weekly-us/src/pages/MeetingSummaryPage.vue` checks `canUseAiSummary` before checking for a saved insight (around line 170). Sharing also suppresses the insight when generation is unavailable (around line 336). Once allowance mapping is repaired, using the last credit can immediately lock the recap just generated. Expired Premium access can also hide historical results.

Required outcome: separate permission to read an existing summary from permission to generate a new one. Preserve workspace authorization while keeping stored summaries readable/shareable after allowance exhaustion or subscription expiry. Audit `MeetingDetailsPage.vue` for the same gating problem.

### AI-05 [P1]: Identical concurrent requests can generate and charge twice

The completed-cache lookup and pending-request insertion are separate in `src/modules/ai/ai.service.ts` (around line 185). `src/modules/ai/ai.repository.ts` inserts a new row for each request. There is no active-generation uniqueness constraint on the input hash in the reviewed migrations.

Two devices or overlapping retries can both miss the cache, reserve separate credits, and call OpenAI. The workspace credit lock limits total allowance, but does not deduplicate identical generations.

Required outcome: atomic server-side idempotency for workspace, meeting, and generation input; one provider call and one settled credit for concurrent identical input; defined retry behavior after a failed attempt.

### AI-06 [P1]: Exhausted stale reservations cannot reach their cleanup path

`src/modules/ai/ai.service.ts` rejects exhausted allowance before calling the reservation RPC (around line 221). Expired reservations are released only inside that RPC in `supabase/migrations/20260829120000_add_recap_allowances_and_member_caps.sql` (around line 31).

If stale reservations consume all available credits, later calls fail before cleanup. Free lifetime allowance can remain blocked indefinitely. Interrupted pending AI request rows also need reconciliation.

Required outcome: exclude/release stale reservations before deciding availability, or combine cleanup and reservation into one authoritative operation. Provide safe, idempotent reconciliation of abandoned requests without releasing active or settled work.

Implementation update, 2026-09-04: implemented in the backend working tree. A workspace-locked, service-role-only recovery RPC marks eligible stale pending requests as failed and releases only their linked stale reserved credits. Generation reconciles before its AI-05 claim, and subscription status reconciles before Free/Premium allowance counts. Focused regression tests, the full backend suite, typecheck, and build pass. The isolated-local-Supabase integration test is guarded and skipped because no local credentials are configured; local database, staging, manual interruption, and release verification remain required. This is not a release sign-off.

### AI-07 [P1]: Summary persistence and credit finalization can disagree

`src/modules/ai/ai.service.ts` writes the meeting summary, marks the request completed, and settles the credit as separate operations (around line 280). If a later write fails, the catch block can release credit and mark the request failed even though a summary exists. Cleanup errors can also replace the original failure.

Required outcome: atomically finalize the saved summary, completed request, and settled reservation; make finalization retry-safe; preserve the primary error when cleanup fails; reconcile interrupted operations. Do not hold a database transaction open during the external provider call.

### AI-08 [P1]: Provider failures are too generic for operators and clients

The catch block in `src/modules/ai/ai.service.ts` collapses most provider failures into `ai_summary_generation_failed` (around line 324). `src/modules/ai/openai.client.ts` reads `output_text` without explicitly classifying response status, refusal, or incomplete output.

Required outcome: safely distinguish quota exhaustion, authentication/model configuration errors, rate limiting, timeout/network failures, refusal, incomplete output, and invalid structured output. Log provider request ID, safe error class/code/status, model, duration, and token usage where available. Never log prompts, meeting content, keys, or auth headers. Preserve stable safe mobile errors.

The Responses API exposes status, error, and incomplete details: [OpenAI Responses reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

## Important pre-pilot improvements

### AI-09: Keep actual tasks and agreements authoritative

`../weekly-us/src/pages/MeetingSummaryPage.vue` prefers nonempty AI task/agreement arrays over the original meeting records (around line 307). A model omission or hallucination can change the apparent commitments.

Render committed tasks and agreements from stored meeting data. Keep AI narrative supplemental and label any proposed changes as suggestions requiring confirmation.

### AI-10: Make model configuration reproducible and observable

`src/modules/ai/summary-prompts.ts` hard-codes models for all six known templates, so `AI_MODEL` acts only as a fallback. The reviewed mapping uses `gpt-5.4-nano` for four templates and `gpt-5-mini` for couple reset/conflict cleanup, with an 800-token output cap.

Define and document override precedence. Persist effective model and prompt version with each request; consider pinned model snapshots. Test each chosen model's latency, output budget, and quality instead of assuming a valid model ID is sufficient.

GPT-5.4 nano and mini support Responses and Structured Outputs: [nano documentation](https://developers.openai.com/api/docs/models/gpt-5.4-nano), [mini documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

### AI-11: Validate generated participant references

Schema-valid output can still contain participant IDs that do not belong to the meeting. Validate task-owner references against the authorized meeting participants before persistence. Do not invent a replacement owner when validation fails.

Relevant files: `src/modules/ai/ai.service.ts`, `src/modules/ai/openai.client.ts`, `src/modules/meetings/meetings.schema.ts`.

### AI-12: Reconcile rate-limit policy and implementation

`src/modules/ai/ai.service.ts` uses 5 requests per user and 20 per workspace per hour. `docs/superpowers/specs/2026-08-29-recap-allowances-design.md` specifies 3 new generations per adult user and 8 per workspace. Counters currently include failed provider attempts, and `resetAt` is a fresh hour from the error rather than the actual window expiry.

Choose one documented policy. Distinguish anti-abuse request limits from recap credits, decide how failed attempts and cached reads count, and report accurate reset information.

### AI-13: Apply trusted entitlement freshness consistently

Allowance resolution in `src/modules/ai/ai.service.ts` uses `resolveEffectivePlan` directly, rather than the stricter entitlement freshness checks used elsewhere. Align AI generation with the trusted subscription policy while preserving Free starter recaps and correct Premium renewal periods.

Relevant areas: `src/modules/ai/ai.service.ts`, `src/modules/billing`, `src/modules/assistant`, and shared plan-limit/entitlement helpers.

### AI-14: Improve mobile error states and allowance copy

`../weekly-us/src/features/meeting/aiSummaryService.ts` recognizes only `ai_summary_rate_limited` as a quota error. Add explicit user-safe handling for `recap_allowance_exhausted`, unsynced meetings, provider outage, timeout/offline, and retryable conflicts. Keep meeting completion successful even if AI fails. Localize the allowance copy currently hard-coded in `MeetingSummaryPage.vue`.

### AI-15: Add privacy-preserving abuse attribution

Evaluate a stable hashed end-user `safety_identifier` in the provider request. Do not send raw email addresses or raw internal identifiers. Keep it backend-owned and document the identity lifecycle.

OpenAI recommends stable privacy-preserving end-user attribution: [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).

### AI-16: Evaluate quality, safety, cost, and latency before inviting users

Use synthetic/anonymized cases covering all six templates, supported languages, minimal meetings, family conflict, prompt injection, sensitive child/health content, absent owners/dates, contradictory notes, and large meetings.

Measure factual consistency, omitted commitments, invented commitments, owner/date accuracy, refusals, latency, and token cost. Confirm users understand when shared meeting data is sent to OpenAI, particularly automatic generation. Prompts and `store: false` are useful safeguards, not a substitute for quality evaluation or a review of the provider's data-handling terms.

## Existing strengths to preserve

- Provider keys and calls stay backend-only.
- Requests use `store: false` and strict Structured Outputs.
- Prompts treat meeting content as untrusted and prohibit invented commitments, blame, therapy, and regulated advice.
- `src/modules/ai/summary-payload.ts` whitelists fields and excludes private notes.
- Workspace scoping, adult-role enforcement, RLS, credit reservation, token usage, rate limits, and safe client errors already exist.
- Meeting sync preserves the server-owned AI summary instead of accepting arbitrary client replacements.

## Verification recorded during the review

| Check | Recorded result |
| --- | --- |
| Backend TypeScript | Passed |
| OpenAPI validation | Passed |
| Focused backend AI tests | 37/39 passed; two route tests have stale authorization expectations |
| Full backend test suite | Not green; the same AI route failures plus suite hook timeouts |
| Mobile automated tests | 425 passed |
| Direct mobile app TypeScript check | Failed, including the `assistantRecap` mismatch and unrelated existing type errors |
| Synthetic OpenAI smoke test | Reached provider; rejected due to exhausted credit balance |
| Live Supabase migration/concurrency tests | Not run |
| Funded real-model quality evaluation | Not completed |

Do not treat a passing root `vue-tsc --noEmit` invocation or mocked unit tests as proof of mobile app type correctness or provider readiness. Run the actual app tsconfig and staging workflow.

## Release recommendation

Resolve AI-01 through AI-08 before first users. Complete the associated automated/database tests, address AI-09 through AI-16 or explicitly record any accepted pilot limitations, and run a funded staging evaluation. Use the linked checklist for execution order and release sign-off.
