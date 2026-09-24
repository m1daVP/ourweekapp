# Meeting Follow-through Implementation Plan

**Goal:** Deliver grounded, actionable follow-through for all six meeting templates.

**Architecture:** Add an optional versioned followThrough field to persisted summaries, with required observations in new provider responses. Resolve provider source tokens against sanitized meeting content on the server; render the same result component on both mobile recap screens.

**Tech Stack:** Fastify, Zod, TypeScript, Vue, Vitest, existing OpenAI client.

## Global constraints

- No new dependencies, commits, deployment, or destructive migrations.
- Preserve private-content exclusion, authorization, quotas, legacy summaries, and revision conflict handling.
- Zero to three observations; all writes require the user's explicit in-app confirmation.
- All six templates and English, Ukrainian, Spanish are required.

## Task 1: Grounded contract and freshness

Files: src/modules/ai/{summary-source.ts,follow-through.ts,follow-through.schema.ts,summary-payload.ts,ai.schema.ts,openai.client.ts,ai.service.ts}, tests/ai.follow-through.test.ts.

Interface: buildSummarySourceSnapshot(meeting) returns canonical shared data; buildGroundedSummaryOutput(meeting, output) resolves references and computes SHA-256 provenance. Provider observation sourceRefs are tokens; stored sourceRefs are backend-resolved descriptors.

- [x] Test skipped/done task preservation, invalid/private references, empty observations, duplicate task suggestions, and fingerprint stability under summary-only writes.
- [x] Add strict provider observations schema and optional stored followThrough schema.
- [x] Generate compatibility task/agreements from actual source records, validate provider output and resolve all references before saving.
- [x] Run focused tests and npm run typecheck.

## Task 2: Mobile result and actions

Files: weekly-us/src/features/meeting/{types.ts,summarySource.ts,aiSummaryService.ts,components/MeetingFollowThrough.vue}, src/shared/api/aiApi.ts, both recap pages, localization and export services, focused component/service tests.

- [x] Add DTO types and preserve optional task status; old tasks are snapshots.
- [x] Compare SHA-256 canonical source data with saved sourceFingerprint; fail closed while checking or unavailable.
- [x] Render shared observation cards, source navigation, question copying, and confirmed task drafts through existing editors.
- [x] Mark stale/legacy results and support deliberate regeneration with existing allowance controls.
- [x] Update text/Markdown exports and localized labels; test confirmation/cancel, stale state and legacy rendering.

## Task 3: All prompts and quality corpus

Files: summary-prompts.ts, evaluation.ts, evaluation-fixtures.ts, run-ai-evaluation.ts, ai.evaluation.test.ts.

- [x] Update all six prompts to prioritize evidence-backed added value, preserving models and bumping versions.
- [x] Cover each template in all three locales with gap/resolved/ambiguous cases.
- [x] Validate actual provider contract using buildGroundedSummaryOutput; separate mechanical pass from human quality judgment.
- [x] Document usefulness rubric and produce inspectable synthetic evidence when live evaluation is available.

## Task 4: Integration and verification

Files: backend exports service/PDF renderer, OpenAPI artifact, affected contract tests, design verification notes.

- [x] Confirm JSON storage and RPC preserve additive fields without a migration.
- [x] Include follow-through observations and source snapshot status in PDFs.
- [x] Run backend typecheck/tests/OpenAPI generation; frontend build/check/tests.
- [x] Inspect mobile UI and rendered PDF where runtime tools permit; report native-device and live-model limitations explicitly.
- [x] Review changes for invalid actions, stale content, privacy leakage, and compatibility regressions.

