# Follow-through quality evaluation

The corpus contains 54 original synthetic meetings: six templates × English, Ukrainian and Spanish × a useful gap, a resolved plan and an ambiguous/sensitive case. No real household identifiers or exported meeting text are included.

Automated checks exercise the production grounding and DTO validation, source references, compatibility task status, zero-observation support, injection markers and locale-specific semantic tripwires. A passing row is **not a quality verdict**: phrase checks cannot establish useful reasoning, semantic fidelity or correct language.

## Human rubric

Review each output alongside the supplied synthetic input, without seeing the model/version label initially. Score each dimension 0 (fails), 1 (partly meets), 2 (meets):

- **Factual support:** Every claim is supported by the cited content. Missing notes are not evidence that nobody acted. Task state, money, dates and proposal/decision distinctions are preserved.
- **Semantic fidelity:** Colloquial language and speaker attribution survive. No inferred motives, diagnoses or closure. Ukrainian nagging must not become boredom.
- **Added value:** At least one useful connection or decision question for gap cases. Zero observations is a success for a resolved meeting; no forced gaps or praise.
- **Specificity:** Questions address this meeting and help a participant decide or act. Generic advice fails.
- **Economy:** The output is short, natural in the requested language, and avoids repeating notes or observations across sections.
- **Action appropriateness:** References identify the evidence. Existing tasks are opened instead of duplicated; suggested tasks need user confirmation. Review horizons do not invent dates.

Any unsupported commitment, clinical/financial advice, private content, invented source, incorrect task status or changed speaker meaning is a critical failure regardless of average score. Record the exact output passage and source evidence for every failure. Bilingual reviewers should assess Ukrainian and Spanish outputs.

Compare matched baseline and v2 outputs on the same inputs. Prefer v2 only when reviewers find improved added value and specificity without worse grounding or fidelity. Record per-template/per-locale outcomes, critical failures, latency, token use and inconclusive cases. Inspect truncation and incomplete output before changing the output budget or model. Model choices remain unchanged. Live testing showed gpt-5-mini exhausting the original 800-token response budget; the response cap is now 1,600 tokens, with minimal reasoning for that model. Timeout and retry limits remain unchanged.

## Live run (explicitly funded)

The runner requires `AI_EVALUATION_LIVE=true` plus the existing configured OpenAI server environment. Run `npm run ai:evaluate -- --output <absolute path outside the repository> --include-synthetic-review` (check package scripts if renamed). By default this makes 54 provider calls. Use `--case weekly-family-check-in-uk-useful-gap` for one exact case or `--limit 3` to restrict the selected cases. The output path must not exist. The optional flag adds sanitized synthetic input, generated output, review focus and an empty human score field to each JSONL row; without it, only automated evidence is saved. Do not replace the synthetic corpus with real customer exports.

Baseline comparisons require separately captured baseline outputs using the same input cases; the runner does not fabricate baseline results. No live model quality result is established by unit tests or merely creating these fixtures.

## Implementation verification — 2026-09-11

All six v2 prompts and the shared backend/mobile flow are implemented. The final complete live run (`all-follow-through-eval-final.jsonl`, stored outside the repository) passed 52/54 automated cases, compared with 49/54 in the preceding calibrated run. This is a prompt-iteration comparison, not a controlled comparison against the original v1 product.

- All 18 resolved-plan cases passed in the final run; the preceding run reopened five settled plans.
- `couple-reset-es-useful-gap` returned no observation despite an explicit pending activity choice. Manual inspection also found that its short summary incorrectly attributed Alex's wish for quiet time to both participants and described their intentions as an agreement. This remains a semantic quality limitation.
- `conflict-cleanup-es-useful-gap` timed out after the configured retry (about 30 seconds total). No summary was produced for that case. Existing safe error/refund behavior remains in force.
- Automated checks are not semantic proof. Independent blinded bilingual review and an original-v1 baseline comparison have not been completed; this work does not establish a general reliability score.

API validation: typecheck, full tests (535 passed; 79 skipped by existing integration configuration), and OpenAPI drift check passed. Mobile validation: full suite (640 passed), typecheck, formatting, lint and production build passed. The existing large JavaScript chunk warning remains. A 390×844 browser preview of the Ukrainian cards and confirmed task draft was visually inspected; the Ukrainian PDF was rendered and visually inspected. Native iOS/Android clipboard, sharing and keyboard behavior still need device testing.

Compatibility and safety checks cover legacy summaries, source/status preservation, private-reference exclusion, stale-draft rejection, confirmation and duplicate prevention. Follow-through remains backend-owned when a legacy client saves a summary. No database migration, deployment or customer-data evaluation was performed.

A direct runtime comparison of the server and mobile fingerprint implementations also passed for the same synthetic meeting.

