# Meeting follow-through across all templates

Status: approved and implemented. Code verification passed; live-model limitations and outstanding independent review are recorded in docs/ai-follow-through-evaluation.md.

## Outcome and scope

Help participants identify useful next steps after a completed meeting. Replace repetitive AI recap presentation with a short overview and zero to three evidence-backed observations. Implement and evaluate weekly-family-check-in first, then apply the same complete flow to all five other templates before considering this work complete.

Scope includes backend prompts, structured output, validation, caching, mobile result presentation, source navigation, confirmed follow-up actions, exports, localization, and regression/quality evaluation. Existing guided meeting section order and questions remain intact. Historical pattern analysis and interactive AI chat are later work.

## Product flow

The completion screen and meeting detail screen use the same compact follow-through component. Display a one- or two-sentence overview, then at most three observations. Each observation has a short title, an evidence-grounded explanation, a concrete question or explicitly optional suggestion, source links, and at most one primary action. Empty observations are a valid successful result; do not manufacture gaps to fill cards.

Distinguish matters to clarify before the next meeting from questions suitable for the next meeting. This is a suggested review horizon, not an invented deadline. Unknown event dates remain unknown. Positive observations are appropriate only when the notes support something useful to continue; avoid compulsory praise.

Actions open an existing task or agreement, open a source section, or open a prefilled task editor for an unscheduled next step. The user selects responsibility and timing and confirms any write. Never create duplicate tasks for existing commitments. Next-meeting questions remain visible in the saved follow-through view and can be copied; do not ship an "add to next meeting" button without durable agenda storage and a working retrieval flow. A dedicated agenda queue is outside this first implementation.

## Output and evidence contract

Add a versioned followThrough object to the existing summary DTO. It contains version: 1, observations (maximum three), and backend-owned source fingerprint metadata. Preserve existing summary fields for older clients and stored records; the new mobile UI emphasizes followThrough when available and falls back to the legacy presentation otherwise.

Each observation contains title, explanation, question, kind (clarify or continue), reviewHorizon (beforeNextMeeting or nextMeeting), sourceRefs, and an optional action descriptor. A sourceRef identifies a sanitized section and, when available, a note, task, or agreement. Use request-local source tokens for legacy items without IDs; resolve these server-side to stable source descriptions and available IDs. The model cannot choose arbitrary URLs, workspace IDs, or executable actions.

The backend validates every reference against the actual sanitized input before saving. Action targets must resolve to the same meeting and authorized workspace. Invalid references or output fail safely through the existing provider error path; do not persist actionable invented references. Suggestions are separate from recorded agreements and tasks.

Keep task status and source identity in the compatibility task DTO as optional additive fields. Generate recorded task facts from sanitized source data where possible, rather than asking the model to reconstruct owners, dates, or status. Frontend normalizers preserve supplied status; legacy items without status are historical recap items and must not become actionable open tasks by assumption.

## Input and freshness

Include section and item reference tokens, actual task statuses, responsibility, supplied dates, and meeting completion time. Retain existing private-content exclusion and input limits. Only current-meeting shared content is used. Missing information means "not recorded here", not proof that nobody handled it.

Compute a deterministic fingerprint of the shared meeting content used for generation. Exclude the summary itself, revision counters, and timestamps changed only by summary persistence. Recompute using the same canonical representation when assessing freshness. Locale and prompt version remain part of generation/cache identity; content freshness specifically tracks source data changes.

When source content changes, keep the old result visibly marked as based on an earlier version, disable its mutating suggestion actions, and allow deliberate regeneration through existing allowance checks. Opening a screen never spends an AI allowance. Legacy summaries with no fingerprint are labeled as saved snapshots without claiming verified freshness. Existing generation revision conflict checks remain in place.

## Prompt behavior shared across templates

Define success as a useful connection, unresolved decision, specific follow-up question, or supported practice worth continuing. Penalize mere restatement and generic advice. Zero useful observations is acceptable. Preserve colloquial meaning and speaker attribution; do not turn one participant's account into a shared fact. Never infer motives, diagnose, assign blame, invent commitments, or supply professional advice. Embedded user instructions remain untrusted.

Use concise English, Ukrainian, and Spanish instructions/examples. Bump all template prompt versions. Keep configured models initially so prompt and product improvements can be measured independently. Increase output budget only if structured-output evaluation demonstrates a need.

## Required template-specific outcomes

| Template | Useful reasoning | Boundaries and representative evaluation |
| --- | --- | --- |
| Weekly family check-in | Connect upcoming plans, task state, and agreements; surface unresolved practical choices | Ukrainian nagging idiom must not become boredom; skipped housing task must not become open; spending agreement and planned purchases prompt clarification without declaring a contradiction |
| Family with kids | Connect care logistics, routines, and explicit handoffs; identify genuinely unrecorded coverage | Appointment logistics only; no invented medical checklist or developmental judgment; fully assigned care needs no extra task |
| Money check-in | Separate decisions from options; clarify scope of spending agreements and explicit competing plans | Preserve numbers and dates; no invented budgets, unnecessary-expense judgments, or financial recommendations |
| Busy week planning | Identify evidenced schedule overlaps, dependencies, and missing backup decisions | Overlap requires explicit time/availability evidence; shared responsibility is not automatically unassigned; contingencies remain contingencies |
| Couple reset | Connect explicitly expressed needs with recorded practical agreements; offer an optional concrete clarification | No motive inference, relationship diagnosis, or mandatory repair plan; preserve whose account is being described |
| Conflict cleanup | Preserve distinct accounts/needs; identify whether a next step and review point were actually agreed | Do not decide who is right, invent reconciliation, or treat one person's proposed change as mutual agreement |

Unknown templates use the shared grounded behavior with no assumed section semantics.

## Integration and compatibility

Update AI Zod schemas, provider JSON schema, payload sanitizer, service validation, mocks, meeting read/write schemas, client API types, normalizers, persisted types, and sync merging together. Read legacy summaries without destructive conversion. Extend cache identity with new prompt/output version. Confirm schema serialization retains additive fields end to end.

Use existing JSON summary storage if it supports the additive structure; inspect finalization RPCs and validation before implementation. No destructive schema change is proposed. Update mobile text/Markdown exports and backend PDF export where they consume the summary so observations and snapshot state remain understandable outside the app.

Keep current Premium gating, quota accounting, auth, ownership checks, privacy filtering, loading, refusal, offline, retry, and generation conflict behavior. No new dependency is expected.

## Verification and delivery sequence

1. Implement versioned contract, provenance, status preservation, and source freshness with focused regression tests.
2. Implement weekly prompt and mobile flow, including source navigation and user-confirmed task draft actions. Use a synthetic derivative of the user's example with new IDs; do not commit the supplied household identifiers or raw export.
3. Complete all five remaining prompts and representative fixtures in all three locales. Each template needs a useful-gap example, a fully resolved example, and an ambiguous/sensitive example.
4. Update all summary consumers, exports, localization, and compatibility tests.
5. Run backend typecheck and tests, frontend build/check and focused tests. Verify narrow mobile layouts, stale and legacy results, source actions, confirmation/cancel, offline state, and sync conflicts. Report native-device checks separately if unavailable.
6. Compare real model outputs against baseline using task-specific human review: factual support, semantic fidelity, added value, specificity, repetition, and action appropriateness. Include latency/token usage. Automated schema/phrase checks alone do not establish usefulness. Report whether live evaluation was actually run and any credentials/provider limitations; never claim quality gains from mocked outputs.

Acceptance: all six templates use the new flow; no skipped/done task is silently made open; no suggestion is saved as a commitment without confirmation; references resolve to allowed source content; changed meeting content is not presented as a current AI assessment; old stored summaries still render; supplied and synthetic regression scenarios pass.

