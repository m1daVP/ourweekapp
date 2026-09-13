# Plan: Real per-template AI summary prompts (A-1)

## Context

`weekly-us-api`'s AI meeting-summary flow (`src/modules/ai/`) is architecturally production-ready but ships placeholder prompts: `MOCK_TEMPLATE_PROMPTS` in [summary-prompts.ts](src/modules/ai/summary-prompts.ts#L31-L56) contains literal `"MOCK TEMPLATE PROMPT: <template>"` strings for all 6 meeting templates instead of real guidance. This is item **A-1** from `APP_STATE_12_07_2026.md` / `APP_PROMPTS_HANDOFF.md`, flagged as pre-v1 work. An abandoned scratch draft (`AI_PROMPTS.js` at the API root, untracked, still referencing the old `gpt-4.1-mini` model) was the intended source for real prompts but was never folded in.

The fix is to replace the 6 mock blocks with real, template-specific guidance so each summary actually reflects what that template's sections are about (kids' routines vs. money vs. conflict, etc.), while preserving the existing safety/neutrality rules already in `BASE_SUMMARY_SYSTEM_PROMPT` — notably "do not diagnose, assign blame, provide therapy, or make psychological claims." Per explicit product constraint: **this is not a medical or mental-health app and must never assign blame** — the per-template prompts reinforce this most heavily on the two emotionally-sensitive templates (`couple-reset`, `conflict-cleanup`) and on `family-with-kids`' health section.

Scope is prompts only — model precedence, timeouts, idempotency, and the output-language instruction (handoff items 3–6) are explicitly out of scope for this change, per user decision. `AI_PROMPTS.js` is left untouched for now (separate cleanup).

## Source of truth for each template

Confirmed from `weekly-us` frontend's [meetingTemplates.ts](../weekly-us/src/features/meeting/meetingTemplates.ts) (the real section titles/prompts each template actually shows users), cross-checked against `weekly-us-api`'s `summary-payload.ts` (which serializes `templateId`, `locale`, `participants`, and sanitized `steps` — title/prompt/notes/tasks/agreements per section — into the user prompt):

| Template ID | Sections (title — prompt) |
|---|---|
| `weekly-family-check-in` | Good things, Tensions, Tasks, Money/purchases, Kids/family care, Plans, Final agreements |
| `couple-reset` | Appreciation, Frustrations, Emotional load, Time together, Practical agreements |
| `family-with-kids` | Child routines, School/kindergarten, Health, Activities, Parent responsibilities, Purchases |
| `money-check-in` | Upcoming expenses, Subscriptions/bills, Purchases, Saving goals, Financial concerns, Decisions |
| `conflict-cleanup` | What happened, What each person needs, What should change, Concrete next step, Follow-up date |
| `busy-week-planning` | Schedule overview, Meals, Childcare, Shopping, Admin tasks, Backup plans |

## Implementation

**File:** `src/modules/ai/summary-prompts.ts`

1. Rename `MOCK_TEMPLATE_PROMPTS` → `TEMPLATE_SUMMARY_PROMPTS`, keep the same `Record<keyof typeof TEMPLATE_SUMMARY_MODELS, string>` typing, and replace each value with real guidance grounded in that template's actual sections:

   - **`weekly-family-check-in`**: highlight the week's wins alongside unresolved tensions; group tasks by what still needs an owner or date; capture money/purchase decisions and family-care needs as separate concrete items; list agreements exactly as stated, never invented.
   - **`family-with-kids`**: focus on routine changes, care coordination, and who's responsible for what; treat health/appointment mentions as logistics only — explicitly no medical advice, diagnoses, or developmental judgments; frame coverage/handoff gaps as practical tasks, not criticism of either parent.
   - **`money-check-in`**: summarize concrete numbers/dates/decisions exactly as given, never estimate, extrapolate, or recommend financial products/strategies; separate what was decided from what's still open; name financial concerns plainly without alarming language or judgment about spending habits.
   - **`busy-week-planning`**: prioritize items with a deadline or single owner; flag anything that looks double-booked or unassigned; keep backup plans clearly separate from the primary plan as contingencies, not commitments.
   - **`couple-reset`**: reflect appreciation and frustration neutrally and in proportion to what was written, favoring neither partner's account; describe emotional load as a shared practical fact, not a psychological assessment of either person; turn repair language into a small concrete next step; never label the relationship's health or either partner's character.
   - **`conflict-cleanup`**: describe what happened as a neutral factual account from both people's own words, never deciding who was right or assigning fault; list what each person needs as separate parallel statements even if they conflict; keep "what should change" about future actions, not character or intentions; always surface a concrete next step and follow-up date when one was given.

2. Replace `UNKNOWN_TEMPLATE_PROMPT`'s mock text with real fallback guidance (still neutral/generic) for any templateId that isn't in the known map, e.g.: summarize using only the given sections/notes/tasks/agreements, group related items together, keep language neutral and non-judgmental.

3. `buildSummarySystemPrompt` keeps its current logic (`BASE_SUMMARY_SYSTEM_PROMPT` + per-template lookup with unknown-template fallback) — no signature or behavior change, only the string content changes.

4. Leave `BASE_SUMMARY_SYSTEM_PROMPT`, `resolveSummaryModel`, `TEMPLATE_SUMMARY_MODELS`, and token/model constants untouched.

## Test update

**File:** `tests/ai.service.test.ts`

- Line 331 currently asserts `call?.systemPrompt` contains the literal `'MOCK TEMPLATE PROMPT: weekly-family-check-in'`. Update this assertion to check for a stable substring of the new `weekly-family-check-in` prompt text instead (e.g. a phrase like `'group tasks by what still needs an owner'`), so the test still proves the correct per-template block was selected without pinning to placeholder text.
- No other tests reference the mock prompt text (confirmed via grep — only this one assertion and the source file match `MOCK TEMPLATE PROMPT` / `MOCK_TEMPLATE_PROMPTS`).

## Verification

1. Run the AI test file in isolation (per handoff env note — full suite has unrelated timeout flakiness): `npx vitest run tests/ai.service.test.ts`.
2. `npm run typecheck` (prompt strings are plain TS, low risk, but keep the existing project habit of checking).
3. Spot-read the final `buildSummarySystemPrompt(templateId)` output for 2–3 templates (e.g. via a quick local script or the test's captured `call.systemPrompt`) to eyeball tone and confirm no blame/diagnosis language crept in.
4. Do not attempt a real OpenAI call — that's A-2 (smoke test), explicitly out of scope here and already tracked separately in the handoff.

## Suggested skills after implementation

- `/code-review` (low/medium effort is enough — this is prompt-string content, not logic).
- `/propose-commits` when ready to commit, since the backend working tree has other pending items (Sentry DSN, `render.yaml`, etc.) that must stay separate from this change.
