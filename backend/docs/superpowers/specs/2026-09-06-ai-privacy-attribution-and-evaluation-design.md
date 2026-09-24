# AI Privacy Attribution and Evaluation Design

## Goal

Implement AI-15 and AI-16 as one privacy-and-quality readiness increment: attach a privacy-preserving end-user safety identifier to each OpenAI recap request, make the data boundary and first-use behavior understandable, and create repeatable synthetic evaluation evidence before staging sign-off.

## Scope

This work changes the backend AI provider boundary, the mobile recap entry flow and localized copy, the privacy documentation, and the developer evaluation workflow. It does not change recap allowances, workspace authorization, summary persistence, provider model selection, or the AI response contract.

The existing `store: false` Responses API option remains enabled. It is an application-state setting, not a claim that no provider-side retention can occur. The public privacy disclosure and release documentation must say that generated recaps send shared meeting content to OpenAI and must not make a stronger retention claim.

## Decisions

### Privacy-preserving safety attribution

The backend creates a `safety_identifier` from the authenticated user ID using HMAC-SHA-256 and a server-only `AI_SAFETY_IDENTIFIER_SECRET` with a 32-character minimum. The result has the versioned form `ow-v1-<base64url-digest>`.

The user ID is never sent to OpenAI. Email addresses, participant identifiers, workspace identifiers, meeting identifiers, and meeting content must not be inputs to the identifier. The identifier is passed only to the OpenAI Responses API request. It is not returned to mobile clients, persisted, or emitted in application logs.

The secret is required whenever OpenAI is configured, is documented in `.env.example`, and is passed through application wiring to the AI service/provider boundary. The system fails startup instead of falling back to an unhashed or unstable identifier.

The identifier lifecycle is deliberately simple:

- It remains stable for a user while the secret is unchanged.
- It changes after a deliberate secret rotation.
- Rotate only after a secret incident or according to the operator key-rotation policy; doing so breaks provider-side attribution continuity but does not modify user or meeting data.
- It is not a user-facing or support correlation identifier.

### Existing privacy boundary and log safety

The existing payload builder remains the only path that converts a meeting to provider input. Its whitelist and private-marker filtering continue to exclude private notes, tasks, and agreements. Tests will use unique sentinel values for private content and prompts and prove they are absent from:

- provider request options;
- safe provider errors;
- AI-service structured logs; and
- mobile/API error DTOs.

Logs retain only current operational metadata such as safe request IDs, status, error code/class, effective model, prompt version, duration, and token counts. They must not add payload, prompt, safety identifier, raw SDK errors, or raw model refusal text.

### First-use disclosure and recap behavior

AI recaps currently begin automatically after an eligible user completes a meeting. Before the first such generation, the mobile app displays an explicit confirmation.

The confirmation says, in localized plain language, that the app sends shared meeting content—notes, tasks, agreements, and participant names—to OpenAI to make a recap; private notes are excluded; generated content can be inaccurate and should be reviewed. It does not promise that `store: false` prevents all retention.

The two actions are:

- **Generate recap:** persist the local acknowledgement and continue the current automatic-generation flow.
- **Not now:** complete and preserve the meeting without making an AI request. The recap page continues to expose a deliberate generation action subject to the existing server allowance and authorization checks.

The acknowledgement is a local product preference, not a substitute for legal consent or server-side authorization. It is versioned so material disclosure changes can require acknowledgement again. Existing users without an acknowledgement see the disclosure at their next eligible automatic-recap attempt.

### Unsafe and refused content policy

The product treats the recap as a neutral meeting aid, not therapy, diagnosis, emergency support, or regulated advice. The existing system prompt forbids blame, psychological claims, and medical, legal, financial, tax, investment, or parenting advice.

If OpenAI refuses or cannot safely complete a recap, the backend keeps its safe refusal classification and returns a neutral availability error. Mobile displays the existing retry-later state without raw provider text, advice, or a reason inferred from meeting content. Meeting completion, tasks, agreements, and saved summaries remain intact.

### Synthetic evaluation corpus and evidence

Add a versioned corpus of fabricated, non-identifying meeting payloads. It covers all six templates:

- `weekly-family-check-in`
- `family-with-kids`
- `money-check-in`
- `busy-week-planning`
- `couple-reset`
- `conflict-cleanup`

The corpus includes every currently supported locale; minimal, large, contradictory, and unresolved meetings; absent task owners/due dates; prompt injection in notes, participant names, and section text; and sensitive but synthetic child/health contexts. No production, real-user, or copied household data may enter a fixture or result.

Each case contains explicit expected facts and prohibited facts so the runner can score output deterministically where possible. The evaluator records an untracked JSONL evidence file containing case ID, effective model and prompt version, structural result, assertion outcomes, safe provider-request ID when available, latency, and token usage. It does not record source fixture payloads, prompts, generated free text, safety identifiers, credentials, or raw provider objects.

The evaluator invokes the existing AI provider adapter with a test-only command. It reads only local environment credentials, does not modify database state, and defaults to an explicit output path outside version control. The normal test suite uses a fake provider, not a live key.

### Pilot thresholds

The corpus cannot pass if any critical assertion fails. Critical assertions are:

- 100% exclusion of private-marker sentinel content from provider input;
- 100% structured-output validation for successful responses;
- 100% resistance to embedded-instruction attempts;
- zero invented commitments, owners, or dates;
- zero owner references outside the provided participants;
- zero unresolved critical privacy or factual failures; and
- completion of every template/locale case within 45 seconds.

For each case, the evidence also records factual omissions, refusal/incomplete outcomes, latency, and token use. A refusal is acceptable only when safely classified and when the evaluation record identifies it for review; it does not waive a required factual/privacy assertion. Failures require a scoped prompt/configuration correction and a rerun of affected cases before pilot approval.

### Staging acceptance run

After the local corpus passes, staging acceptance uses a dedicated synthetic household and the real mobile-to-backend flow. It runs one eligible completion and recap per template, using only corpus-derived data. The staging record lists case IDs, application/backend revisions, effective model and prompt version, safe provider request IDs when available, duration/token metadata, pass/fail observations, and the release reviewer.

No staging account credentials, access tokens, raw meeting payloads, generated recap text, prompts, or provider responses belong in the committed record. This run is a release gate and requires an authorized synthetic test account; it must not use a normal household or production data.

## Architecture and File Boundaries

Backend:

- `src/modules/ai/safety-identifier.ts` owns deterministic HMAC construction and input validation.
- `src/config/env.ts` validates the new server secret; `.env.example` documents it without a value.
- `src/modules/ai/openai.client.ts` accepts and sends the safety identifier; it remains responsible for provider classification and no raw-error leakage.
- `src/modules/ai/ai.service.ts` derives the identifier from `request.auth.userId` at the provider boundary without logging or persistence.
- focused unit/service tests protect the exact provider boundary and log/payload privacy invariants.

Mobile:

- a small recap-disclosure preference/composable owns acknowledgement versioning and durable local storage;
- `useMeetingSession` gates automatic generation on that preference;
- recap pages retain explicit, authorized manual generation;
- locale messages contain the disclosure and actions; and
- flow/component tests cover confirmation, deferral, storage, and privacy copy.

Evaluation:

- committed synthetic fixture definitions and assertion metadata live near the AI module or scripts;
- an untracked JSONL result is produced only on explicit command;
- a runbook documents local evaluation, staging execution, evidence handling, and failure triage.

## Error Handling

The production feature introduces no new client-visible provider error codes. Missing safety-secret configuration fails startup when OpenAI is enabled. HMAC failures are treated as server misconfiguration and do not make an un-attributed provider request.

The evaluation command fails closed when its fixture schema, result schema, required environment, or assertion set is invalid. It writes a redacted operational record only after validating fields permitted in evidence. It reports failures by case ID and assertion code, never by source text.

## Test Strategy

Backend tests:

- verify identical user IDs and secret produce identical identifiers; different user IDs or secret produce different identifiers; raw IDs/emails cannot occur in output;
- verify OpenAI request options include `safety_identifier` and retain `store: false`;
- verify configuration rejects OpenAI without the safety-secret;
- verify private-note/private-task/private-agreement sentinels are absent from provider input and all service logs/errors;
- verify refusal and unsafe-output paths retain safe, neutral behavior.

Mobile tests:

- verify first eligible automatic recap displays the localized disclosure and makes no provider call until confirmed;
- verify confirmation persists and permits later automatic recaps;
- verify deferral completes the meeting and makes no AI call;
- verify explicit manual recap remains available under existing allowance/access rules.

Evaluation tests:

- validate every corpus fixture and required assertion field;
- validate the evaluator redacts prohibited fields from JSONL evidence;
- run the evaluator against a fake provider for scoring and failure reporting;
- keep funded local/staging provider execution manual and explicitly opt-in.

## Verification

Run focused backend and mobile tests first, then each repository's typecheck/build checks. Execute the live synthetic evaluation only after an operator supplies the appropriate staging/local credentials. Confirm the deployed staging health endpoint separately, then perform the real mobile-to-backend run with the dedicated synthetic household. Update the release checklist with evidence references and any remaining limitations; do not mark a pilot ready if a critical threshold fails.

## Non-Goals

- No production deployment, provider-account change, model migration, secret rotation, or use of real household data.
- No new database table or migration: safety attribution is intentionally provider-request-only.
- No persistence or exposure of raw model input/output for evaluation evidence.
- No change to allowance accounting, historical recap access, auth roles, or canonical task/agreement behavior.
