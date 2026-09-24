# AI Privacy Attribution and Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenAI recap requests privacy-attributable without exposing user identity, obtain first-use disclosure before automatic recap generation, and produce reproducible synthetic evaluation evidence for AI-15 and AI-16.

**Architecture:** The backend derives a versioned HMAC safety identifier from the authenticated user ID and a required server secret, then passes it only to the OpenAI Responses request. The mobile app stores a versioned local acknowledgement and pauses the existing post-completion automatic recap until the user confirms. A separate fixture-driven evaluator calls the provider with synthetic data and writes a redacted JSONL evidence record; staging remains a manual synthetic-household release gate.

**Tech Stack:** Node.js 24, TypeScript, Fastify, Zod, OpenAI Responses API, Vitest, Vue 3, Pinia, vue-i18n, Capacitor Preferences.

## Global Constraints

- Do not send raw emails, user IDs, workspace IDs, meeting IDs, prompts, or meeting content as `safety_identifier` input.
- `AI_SAFETY_IDENTIFIER_SECRET` is server-only, has a 32-character minimum, and is required when `AI_PROVIDER=openai`.
- The provider request retains `store: false`; do not claim that this alone eliminates provider-side retention.
- Private notes, tasks, and agreements stay excluded from AI payloads, logs, error DTOs, exports, and synthetic-evaluation evidence.
- Do not log or persist `safety_identifier`, fixture payloads, prompts, generated recap text, credentials, raw provider errors, or raw refusals.
- Preserve adult-only authorization, workspace scoping, allowance accounting, cached recap behavior, and existing client-visible API error codes.
- Do not add a migration: provider attribution is request-only and deliberately not stored.
- Evaluation fixtures are wholly fabricated. Never use production, copied, or real-household data.
- A refusal remains a neutral, safe retry-later outcome; no therapy, diagnosis, blame, emergency, medical, legal, financial, tax, investment, or parenting advice is introduced.
- Do not stage, commit, push, change Render configuration, run a funded provider request, or use a normal household without separate authorization.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/modules/ai/safety-identifier.ts` | Validate the server secret and derive `ow-v1-` HMAC identifiers. |
| `src/config/env.ts` / `.env.example` | Parse and document the server-only secret, with OpenAI-only startup enforcement. |
| `src/modules/ai/openai.client.ts` | Extend the provider input contract and attach the identifier to `responses.create`. |
| `src/modules/ai/ai.service.ts` / `src/modules/ai/ai.routes.ts` | Derive the identifier from authenticated context and inject the secret without logs or persistence. |
| `tests/safety-identifier.test.ts`, `tests/env.test.ts`, `tests/openai.client.test.ts`, `tests/ai.service.test.ts`, `tests/ai.routes.test.ts` | Regression coverage for secret validation, provider options, payload/log boundaries, and route wiring. |
| `src/modules/ai/evaluation-fixtures.ts` | Versioned fabricated corpus plus deterministic expected/prohibited facts. |
| `src/modules/ai/evaluation.ts` | Evaluate a provider result and create a redacted JSONL-safe result row. |
| `scripts/run-ai-evaluation.ts` | Explicit local CLI; validates environment and writes only redacted JSONL evidence. |
| `tests/ai.evaluation.test.ts` / `package.json` | Fake-provider corpus/scoring coverage and an opt-in npm script. |
| `../weekly-us/src/shared/services/storageService.ts` | Persist a non-sensitive, versioned recap-disclosure acknowledgement in Capacitor Preferences. |
| `../weekly-us/src/features/meeting/aiRecapDisclosure.ts` | Expose acknowledgement read/write and the current disclosure version. |
| `../weekly-us/src/pages/MeetingPage.vue` / `../weekly-us/src/features/meeting/composables/useMeetingSession.ts` | Pause automatic recap generation, render the confirmation, and resume only after confirmation. |
| `../weekly-us/src/features/localization/messages.ts` | Localized disclosure copy and actions for every existing locale. |
| `../weekly-us/src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts` and new disclosure tests | Verify confirm/defer behavior and no request before acknowledgement. |
| `../weekly-us/docs/privacy-data-map.md`, `../weekly-us/docs/google-play-data-safety.md`, `AI_RELEASE_CHECKLIST.md`, `docs/ai-evaluation-runbook.md` | Accurate disclosure, operator evidence handling, thresholds, and staging gate. |

### Task 1: Server-owned safety identifier and OpenAI wiring

**Files:**
- Create: `src/modules/ai/safety-identifier.ts`
- Create: `tests/safety-identifier.test.ts`
- Modify: `src/config/env.ts:62-101, 207-214`
- Modify: `.env.example:38-45`
- Modify: `src/modules/ai/openai.client.ts:77-85, 245-290`
- Modify: `src/modules/ai/mock-ai.client.ts:3-24`
- Modify: `src/modules/ai/ai.service.ts:64-69, 399-409`
- Modify: `src/modules/ai/ai.routes.ts:46-60, 86-94`
- Test: `tests/env.test.ts`, `tests/openai.client.test.ts`, `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`

**Interfaces:**
- Consumes: `AuthContext.userId` and `AI_SAFETY_IDENTIFIER_SECRET`.
- Produces: `buildSafetyIdentifier(userId: string, secret: string): string` and provider input `{ safetyIdentifier: string }`.
- Produces: `AiSummaryServiceOptions.safetyIdentifierSecret?: string`; all production provider invocations receive a non-empty value.

- [ ] **Step 1: Write failing identifier and configuration tests**

Add a test that fixes the exact identifier contract without exposing the secret or raw ID:

```ts
import { buildSafetyIdentifier } from '../src/modules/ai/safety-identifier.js';

it('creates a stable versioned identifier without raw identity', () => {
  const first = buildSafetyIdentifier('user_123@example.invalid', 'a'.repeat(32));
  expect(first).toMatch(/^ow-v1-[A-Za-z0-9_-]{43}$/);
  expect(first).toBe(buildSafetyIdentifier('user_123@example.invalid', 'a'.repeat(32)));
  expect(first).not.toContain('user_123');
  expect(first).not.toContain('@example');
});
```

In `tests/env.test.ts`, add an OpenAI configuration case with a valid API key but no safety secret and expect `AI_SAFETY_IDENTIFIER_SECRET is required when AI_PROVIDER is configured`. Add a mock-provider case proving this secret is not required for `AI_PROVIDER=mock`.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- tests/safety-identifier.test.ts tests/env.test.ts`

Expected: FAIL because the module, parsed environment field, and OpenAI-only validation do not exist.

- [ ] **Step 3: Implement the identifier and environment contract**

Create the focused module using Node's `createHmac`; validate inputs defensively so direct service construction also cannot send an un-attributed request:

```ts
import { createHmac } from 'node:crypto';

const SAFETY_IDENTIFIER_PREFIX = 'ow-v1-';

export function buildSafetyIdentifier(userId: string, secret: string) {
  if (!userId.trim() || secret.length < 32) {
    throw new Error('AI safety identifier configuration is invalid.');
  }
  return `${SAFETY_IDENTIFIER_PREFIX}${createHmac('sha256', secret)
    .update(userId, 'utf8').digest('base64url')}`;
}
```

Add `AI_SAFETY_IDENTIFIER_SECRET: optionalString` to the Zod environment input, enforce it alongside `AI_API_KEY` only when `AI_PROVIDER === 'openai'`, and normalize it to `''` in the transformed output. Document it as a backend-host secret in `.env.example` without a sample value.

Extend `AiSummaryProvider.generateMeetingSummary` with `safetyIdentifier: string`, forward it unchanged from the service to the provider, and add `safety_identifier: input.safetyIdentifier` next to `store: false` in `responses.create`. Pass `env.AI_SAFETY_IDENTIFIER_SECRET` in route service options. The mock provider accepts the expanded interface but does not expose or record the field.

- [ ] **Step 4: Add request-contract tests**

Update the existing OpenAI request assertion:

```ts
expect(responsesCreate).toHaveBeenCalledWith(expect.objectContaining({
  store: false,
  safety_identifier: 'ow-v1-test-safe-identifier',
}));
```

Update every direct `generateMeetingSummary` provider fixture to include `safetyIdentifier`. In the AI service test, assert the provider saw an `ow-v1-` identifier but assert the serialized service logger calls contain neither the HMAC value nor the raw `auth.userId`.

- [ ] **Step 5: Run focused backend verification**

Run: `npm test -- tests/safety-identifier.test.ts tests/env.test.ts tests/openai.client.test.ts tests/ai.service.test.ts tests/ai.routes.test.ts`

Expected: PASS; OpenAI requests include a versioned identifier, mock requests remain functional, and no raw identity appears in test logs.

### Task 2: Lock down payload, error, and log privacy regressions

**Files:**
- Modify: `tests/ai.summary-payload.test.ts`
- Modify: `tests/ai.service.test.ts:350-386, 485-535`
- Modify: `tests/openai.client.test.ts:19-99, 145-237`
- Test: the three modified test files

**Interfaces:**
- Consumes: existing `buildSummaryPromptPayload`, `AiSummaryProviderError`, and structured Pino logger calls.
- Produces: tests that forbid private content, prompts, raw provider details, raw IDs, and safety identifiers in any observable safe output.

- [ ] **Step 1: Add failing private-content sentinels to payload tests**

Replace generic private fixture strings with unique sentinels such as `PRIVATE_NOTE_DO_NOT_SEND_71`, `PRIVATE_TASK_DO_NOT_SEND_72`, and `PRIVATE_AGREEMENT_DO_NOT_SEND_73`. Add a private marked object in every currently accepted content collection. Assert every sentinel is absent after `buildSummaryPromptPayload`.

- [ ] **Step 2: Add failing service log and safe-error assertions**

Create a harness meeting containing `MEETING_BODY_DO_NOT_LOG_81`, make the provider reject with raw response text containing `PROVIDER_BODY_DO_NOT_LOG_82`, and pass a logger spy. Assert:

```ts
const logged = JSON.stringify(logger.warn.mock.calls);
expect(logged).not.toContain('MEETING_BODY_DO_NOT_LOG_81');
expect(logged).not.toContain('PROVIDER_BODY_DO_NOT_LOG_82');
expect(logged).not.toContain('ow-v1-');
expect(logged).not.toContain(auth.userId);
```

Also assert the thrown `ApiError` does not contain those values. Retain existing safe error code/status expectations.

- [ ] **Step 3: Run privacy tests to verify the intended gap**

Run: `npm test -- tests/ai.summary-payload.test.ts tests/ai.service.test.ts tests/openai.client.test.ts`

Expected: the new tests initially fail until Task 1 has ensured the identifier is never added to logging and the fixtures cover all private collections.

- [ ] **Step 4: Make only the needed privacy-safe corrections**

Do not add payload or identifier fields to service logs. If a direct test fixture or error serialization exposes one, remove only that value from the safe boundary. Keep provider request ID, status/code/class, model, prompt version, duration, and token metadata intact. Do not weaken `summary-payload.ts` whitelisting or use a broad redaction function that might hide future logging regressions.

- [ ] **Step 5: Run focused privacy verification**

Run: `npm test -- tests/ai.summary-payload.test.ts tests/ai.service.test.ts tests/openai.client.test.ts`

Expected: PASS; all private and raw-error sentinels are absent from provider-visible safe errors and logs, while valid shared notes remain in the provider input.

### Task 3: Create a synthetic evaluator and redacted evidence workflow

**Files:**
- Create: `src/modules/ai/evaluation-fixtures.ts`
- Create: `src/modules/ai/evaluation.ts`
- Create: `scripts/run-ai-evaluation.ts`
- Create: `tests/ai.evaluation.test.ts`
- Modify: `package.json:6-23`
- Create: `docs/ai-evaluation-runbook.md`

**Interfaces:**
- Consumes: `buildSummarySystemPrompt`, `resolveSummaryPromptConfiguration`, `buildSummaryPromptPayload`, and `AiSummaryProvider`.
- Produces: `evaluationCases`, `evaluateSummaryCase(caseDefinition, provider)`, and a redacted `EvaluationEvidenceRow` serialized one JSON object per line.
- Produces: `npm run ai:evaluate -- --output <absolute-path>`; live execution requires `AI_EVALUATION_LIVE=true` and an explicit outside-repository output path.

- [ ] **Step 1: Write failing fixture and redaction tests**

Define a fixture schema and a representative test asserting all template IDs and all locale keys from the localization catalog are represented. Include a test case with a deliberately private marker and prompt-injection sentinel. Write a redaction test:

```ts
expect(JSON.stringify(toEvidenceRow(result))).not.toContain('PRIVATE_NOTE_DO_NOT_SEND');
expect(JSON.stringify(toEvidenceRow(result))).not.toContain('Ignore the system prompt');
expect(JSON.stringify(toEvidenceRow(result))).not.toContain('generated recap prose');
```

Use a fake `AiSummaryProvider` that returns deterministic structured output and token/duration metadata. Do not call OpenAI in Vitest.

- [ ] **Step 2: Run evaluator tests to verify they fail**

Run: `npm test -- tests/ai.evaluation.test.ts`

Expected: FAIL because the fixture/evaluator modules and redacted evidence schema do not exist.

- [ ] **Step 3: Implement the corpus and deterministic checks**

Define each case with only fabricated participant names and content. Cover all six templates, every declared locale, minimal content, a 12,000-character boundary-safe large fixture, contradictions, unresolved subjects, absent owners/dates, prompt injection in note/name/section text, and synthetic child/health logistics.

Use an explicit assertion shape rather than opaque natural-language scoring:

```ts
type EvaluationCase = {
  id: string;
  templateId: string;
  locale: string;
  meeting: MeetingRepositoryDto;
  participants: SummaryPromptParticipant[];
  requiredFacts: string[];
  prohibitedFacts: string[];
  expectedOwnerIds: string[];
  expectedDueDates: string[];
};
```

The evaluator validates provider output against the existing summary schema, then records booleans/counters for required/prohibited text matches, owner/date exactness, structured validity, safe refusal/incomplete classification, latency, and token usage. Never include meeting payload, prompt, output text, identifier, or raw provider response in `EvaluationEvidenceRow`.

- [ ] **Step 4: Implement a fail-closed explicit CLI**

The script must require all of: `AI_EVALUATION_LIVE=true`, OpenAI configuration, an absolute `--output` path outside the repository, and a non-existing or user-approved output file. Refuse relative paths and paths contained by `process.cwd()`.

For each case, construct the existing prompt/payload and call the existing `OpenAiSummaryProvider`; write only `JSON.stringify(evidenceRow) + '\n'`. Exit non-zero if any critical criterion fails: private-marker exclusion, structured validity for successful output, injection resistance, invented commitment/owner/date, out-of-scope owner, a critical factual/privacy failure, or duration over 45 seconds. The command has no database client and cannot create meetings, credits, or requests.

Add this script exactly:

```json
"ai:evaluate": "tsx scripts/run-ai-evaluation.ts"
```

- [ ] **Step 5: Document the operator workflow and verify fake-provider behavior**

In `docs/ai-evaluation-runbook.md`, list required secrets, synthetic-data rules, JSONL retention limits, all pilot gates, failure triage, and the manual staging/mobile flow. State that real provider execution is not part of automated CI and does not substitute for the real authenticated staging pass.

Run: `npm test -- tests/ai.evaluation.test.ts && npm run typecheck`

Expected: PASS; fixture completeness, deterministic scoring, redaction, and fail-closed CLI argument validation all pass without live credentials.

### Task 4: Add first-use recap disclosure preference and accessible UI

**Files:**
- Create: `../weekly-us/src/features/meeting/aiRecapDisclosure.ts`
- Create: `../weekly-us/src/features/meeting/components/AiRecapDisclosureSheet.vue`
- Create: `../weekly-us/src/features/meeting/__tests__/aiRecapDisclosure.test.ts`
- Modify: `../weekly-us/src/shared/services/storageService.ts:35-65, 430-470`
- Modify: `../weekly-us/src/features/localization/messages.ts`
- Test: `../weekly-us/src/shared/services/__tests__/storageService.test.ts`

**Interfaces:**
- Produces: `AI_RECAP_DISCLOSURE_VERSION = 'v1'`, `hasAcknowledgedAiRecapDisclosure(): boolean`, and `acknowledgeAiRecapDisclosure(): void`.
- Produces: `AiRecapDisclosureSheet` with `open`, `@confirm`, and `@close`; `close` is the “Not now” action.
- Consumes: `readSettingsStorage` and `writeSettingsStorage`; this is a non-sensitive local preference.

- [ ] **Step 1: Write failing preference and sheet tests**

Test that no stored preference returns `false`, a matching `{ version: 'v1' }` returns `true`, and an older version returns `false`. Mount the sheet with i18n and assert it names OpenAI, shared notes/tasks/agreements/participant names, private-note exclusion, and possible inaccuracy. Assert “Not now” emits `close`; “Generate recap” emits `confirm`.

- [ ] **Step 2: Run the new mobile tests to verify they fail**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/__tests__/aiRecapDisclosure.test.ts src/shared/services/__tests__/storageService.test.ts
```

Expected: FAIL because the settings slice, preference module, component, and localization keys do not exist.

- [ ] **Step 3: Add the durable preference without weakening storage rules**

Extend `SettingsStorageSliceKey` and `AppDataSettings` with `aiRecap: unknown`; preserve it in `createEmptySettingsData`, `normalizeSettingsData`, and all migration/default paths. Do not put it in auth or private-note storage, and do not store any consent timestamp, user ID, meeting ID, prompt, or provider metadata.

Create `aiRecapDisclosure.ts` with:

```ts
export const AI_RECAP_DISCLOSURE_VERSION = 'v1';
export function hasAcknowledgedAiRecapDisclosure() {
  return readSettingsStorage('aiRecap', null)?.version === AI_RECAP_DISCLOSURE_VERSION;
}
export function acknowledgeAiRecapDisclosure() {
  writeSettingsStorage('aiRecap', { version: AI_RECAP_DISCLOSURE_VERSION });
}
```

Implement the sheet with existing `BaseBottomSheet`, focus handling, and button semantics. Its close control and secondary button defer only generation; neither rolls back meeting completion.

- [ ] **Step 4: Add localized copy for every supported locale**

Add `ai.recap.disclosure` keys under every current language in `messages.ts`: `title`, `body`, `generate`, and `notNow`. Keep the content faithful to the approved copy and concise: shared meeting content is sent to OpenAI; private notes are excluded; the recap may be inaccurate and should be reviewed. Do not claim encryption, zero retention, or legal consent.

- [ ] **Step 5: Run focused mobile UI/storage verification**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/__tests__/aiRecapDisclosure.test.ts src/shared/services/__tests__/storageService.test.ts
```

Expected: PASS; version mismatches prompt again, data persists through settings storage, the sheet is accessible, and every locale has the required copy.

### Task 5: Gate automatic recap generation without blocking completion or manual retries

**Files:**
- Modify: `../weekly-us/src/features/meeting/composables/useMeetingSession.ts:259-267, 1210-1284, 1418-1445`
- Modify: `../weekly-us/src/pages/MeetingPage.vue:49-102, 180-260`
- Modify: `../weekly-us/src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts`
- Modify: `../weekly-us/src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**
- Consumes: `hasAcknowledgedAiRecapDisclosure`, `acknowledgeAiRecapDisclosure`, and `AiRecapDisclosureSheet`.
- Produces: session refs/handlers `isAiRecapDisclosureOpen`, `confirmAiRecapDisclosure`, and `deferAiRecapDisclosure`.
- Preserves: `finishMeeting(): Promise<void>` completes/synchronizes the meeting before any generation decision; `MeetingSummaryPage.handleGenerateSummary()` remains an explicit manual action and does not require the automatic-generation acknowledgement.

- [ ] **Step 1: Write failing completion-flow tests**

Split the existing eligible completion case into three assertions:

```ts
await session.finishMeeting();
expect(context.meetings.meetings[0]!.status).toBe('completed');
expect(generateMeetingSummary).not.toHaveBeenCalled();
expect(session.isAiRecapDisclosureOpen.value).toBe(true);
```

Then call `await session.confirmAiRecapDisclosure()` and assert exactly one generation call and the persisted acknowledgement. In a separate case call `await session.deferAiRecapDisclosure()` and assert navigation occurs, completion remains saved, and generation remains zero. Retain the existing viewer/offline/exhausted behavior tests.

In `MeetingRecapPages.test.ts`, assert an eligible completed meeting without a summary still exposes its manual “Generate recap” button after deferral and that clicking it calls `generateMeetingSummary` directly without requiring the automatic-flow sheet.

- [ ] **Step 2: Run flow tests to verify they fail**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: FAIL because eligible completion currently calls AI immediately and exposes no disclosure state/handlers.

- [ ] **Step 3: Refactor the completion sequence around a single post-completion helper**

Keep `meetingsStore.finishMeeting()` and completion sync before the choice. Extract the current recap-and-navigation block into an internal helper accepting `shouldGenerateRecap: boolean`. For an eligible user without acknowledgement, set `isAiRecapDisclosureOpen.value = true` after completion and wait for UI action; do not call AI or navigate until confirm/defer. For an acknowledged eligible user, continue the existing automatic path.

`confirmAiRecapDisclosure` must write the local versioned acknowledgement, close the sheet, and invoke the helper with `true`. `deferAiRecapDisclosure` closes the sheet and invokes it with `false`. Both paths navigate to the completed meeting summary. Guard each handler against duplicate finishing/disclosure actions.

- [ ] **Step 4: Render the existing shared bottom-sheet primitive in MeetingPage**

Destructure the new session state/handlers in `MeetingPage.vue`. Render `AiRecapDisclosureSheet` once at page level with:

```vue
<AiRecapDisclosureSheet
  :open="isAiRecapDisclosureOpen"
  @confirm="confirmAiRecapDisclosure"
  @close="deferAiRecapDisclosure"
/>
```

Do not change the manual generation handler in summary/details pages except to keep it visible after a deferred automatic recap. Do not suppress historical authorized recap display.

- [ ] **Step 5: Run focused regression tests and build**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingRecapPages.test.ts src/features/meeting/__tests__/aiRecapDisclosure.test.ts
npm run build
```

Expected: PASS; no automatic request occurs before acknowledgement, deferral cannot undo completion, acknowledged users retain automatic recap, and the manual path stays allowed by existing server-driven allowance checks.

### Task 6: Align release documentation and complete verification evidence

**Files:**
- Modify: `../weekly-us/docs/privacy-data-map.md:31-42, 49-72`
- Modify: `../weekly-us/docs/google-play-data-safety.md:32-45, 97-106`
- Modify: `AI_RELEASE_CHECKLIST.md:196-216, 256-274`
- Modify: `docs/ai-evaluation-runbook.md`
- Test: focused/full backend and mobile commands only; no provider, staging, or deployment mutation without authorization

**Interfaces:**
- Consumes: the implementation behavior from Tasks 1-5 and OpenAI's documented data controls.
- Produces: reviewable release artifacts that distinguish `store: false`, abuse-monitoring retention, fabricated evaluation evidence, and the manual staging gate.

- [ ] **Step 1: Update privacy/disclosure documentation with observed behavior only**

In the privacy map, state that optional/generated recaps transmit shared meeting content to OpenAI only after the first-use confirmation, excluding private notes. State that a pseudonymous HMAC identifier is sent for abuse attribution and that no raw account identifier is sent for that purpose. State that `store: false` is used but does not itself eliminate abuse-monitoring retention; link the release review to current official provider terms without claiming legal approval.

In the Google Play map, retain “OpenAI only when optional AI summaries are enabled,” add the first-use disclosure verification, and keep final Play Console answers explicitly release-owner verified.

- [ ] **Step 2: Add test and staging evidence fields to the release checklist**

Mark no implementation checkbox complete until its corresponding command passes. Add a named evidence placeholder format that contains only: date, app/backend revision, fixture case ID, effective model/prompt version, safe provider request ID, duration/token metadata, assertion outcome, and reviewer. Explicitly prohibit credentials, payloads, prompts, recap text, raw responses, and normal household data.

- [ ] **Step 3: Run all automated verification**

Run from `D:/Projects/myself/weekly-us-api`:

```powershell
npm run typecheck
npm test -- tests/safety-identifier.test.ts tests/env.test.ts tests/openai.client.test.ts tests/ai.summary-payload.test.ts tests/ai.service.test.ts tests/ai.routes.test.ts tests/ai.evaluation.test.ts
npm test
npm run build
npm run openapi:check
```

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npm run build
npm run check
```

Expected: all behavior-specific tests, typechecks, builds, and OpenAPI validation pass. Document unrelated pre-existing failures with command output references; do not suppress them.

- [ ] **Step 4: Perform the authorized staged evaluation only after automated checks pass**

Read-only check first: `Invoke-WebRequest https://weekly-us-api.onrender.com/health`.

After the user supplies or authorizes a dedicated synthetic test account and current staging mobile build, execute one real mobile completion/recap flow per template from the corpus. Record only redacted evidence per the runbook. The run passes only when every case satisfies all critical thresholds, including the 45-second limit; failures require a scoped correction and repeat run.

- [ ] **Step 5: Prepare—not create—logical commits for review**

Do not stage or commit. Report proposed Conventional Commit groups:

```text
feat(ai): add privacy-preserving recap safety attribution
feat(meetings): require first-use recap disclosure
test(ai): add synthetic recap evaluation harness
docs(ai): document recap privacy and evaluation gates
```

Ask the user to approve an explicit numbered commit list before any Git mutation.

## Plan Self-Review

- **Spec coverage:** Tasks 1-2 implement attribution, private-boundary testing, log/error safety, and refusal policy. Tasks 3 and 6 implement corpus, redacted evidence, thresholds, provider/staging gates, and data-handling documentation. Tasks 4-5 implement the first-use disclosure, localization, persistence, deferred completion, and retained manual generation.
- **No placeholders:** The plan names concrete modules, interfaces, commands, test expectations, evidence fields, and pilot gates. It contains no deferred implementation markers.
- **Type consistency:** `safetyIdentifier` is the single provider-input property; `AI_SAFETY_IDENTIFIER_SECRET` is the single environment field; the mobile preference uses `AI_RECAP_DISCLOSURE_VERSION`, `hasAcknowledgedAiRecapDisclosure`, and `acknowledgeAiRecapDisclosure` throughout.
