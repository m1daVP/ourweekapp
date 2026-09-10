# AI Summary Output Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every user-visible AI meeting-summary field use the active app language: English (`en`), Ukrainian (`uk`), or Spanish (`es`).

**Architecture:** The API request schema becomes the authoritative boundary for the three supported app locales. The AI service converts the validated locale into a clear system-prompt instruction that enumerates every generated user-visible field; the serialized payload and its existing input hash retain the locale, keeping language-specific cache entries separate. The frontend already sends its current i18n locale, so it needs a regression test rather than new runtime behavior.

**Tech Stack:** TypeScript, Zod 4, Fastify 5, Vitest 4, Vue I18n 11.

## Global Constraints

- Support exactly `en`, `uk`, and `es`; do not add a migration or persist an output locale.
- Output language is the app-selected locale even if source meeting content uses another language.
- The explicit prompt must cover `shortSummary`, every string in all list fields, agreement text, task titles, and `suggestedNextMeetingFocus`.
- Retain locale in the provider payload and cache input hash; summaries in different locales must not share a cache entry.
- Keep API response DTOs unchanged and expose no provider internals.
- Do not add dependencies, stage, or commit without explicit user approval.

---

## File Structure

- Modify `src/modules/ai/ai.schema.ts`: define and use the supported summary-locale schema at the request boundary.
- Modify `src/modules/ai/summary-prompts.ts`: own locale-to-language mapping and build a per-request system prompt with the explicit all-fields output-language contract.
- Modify `src/modules/ai/ai.service.ts`: pass the validated locale to the system-prompt builder before hashing and provider generation.
- Modify `tests/summary-prompts.test.ts`: prove each supported locale creates the explicit output-language instruction.
- Modify `tests/ai.routes.test.ts`: prove the route rejects unsupported locales before it calls the service.
- Modify `tests/ai.service.test.ts`: update old arbitrary-locale cases to supported locales and prove the provider receives a locale-specific instruction while different locale inputs still have distinct hashes.
- Modify `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiGenerationFlow.test.ts`: prove the active frontend i18n locale is passed to the API wrapper.

### Task 1: Define the supported locale contract and localized prompt instruction

**Files:**
- Modify: `src/modules/ai/ai.schema.ts:45-53`
- Modify: `src/modules/ai/summary-prompts.ts:75-143`
- Modify: `tests/summary-prompts.test.ts:1-35`

**Interfaces:**
- Consumes: the app’s existing `en | uk | es` locale contract.
- Produces: `aiSummaryLocaleSchema`, `AiSummaryLocale`, and `buildSummarySystemPrompt(templateId, locale)`.

- [ ] **Step 1: Write failing prompt-contract tests**

```ts
import { buildSummarySystemPrompt } from '../src/modules/ai/summary-prompts.js';

it.each([
  ['en', 'English'],
  ['uk', 'Ukrainian'],
  ['es', 'Spanish'],
] as const)('requires every visible value in %s', (locale, language) => {
  expect(buildSummarySystemPrompt('weekly-family-check-in', locale)).toContain(
    `Write every user-visible output value in ${language}.`,
  );
  expect(buildSummarySystemPrompt('weekly-family-check-in', locale)).toContain(
    'shortSummary, mainTopics, keyTensions, agreements, task titles, and suggestedNextMeetingFocus',
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/summary-prompts.test.ts`

Expected: FAIL because `buildSummarySystemPrompt` has no locale parameter and does not contain the required language contract.

- [ ] **Step 3: Implement the schema and prompt contract**

```ts
export const aiSummaryLocaleSchema = z.enum(['en', 'uk', 'es']);
export type AiSummaryLocale = z.infer<typeof aiSummaryLocaleSchema>;

const SUMMARY_LANGUAGE_BY_LOCALE = {
  en: 'English',
  uk: 'Ukrainian',
  es: 'Spanish',
} as const satisfies Record<AiSummaryLocale, string>;

function buildOutputLanguageInstruction(locale: AiSummaryLocale) {
  return [
    `Write every user-visible output value in ${SUMMARY_LANGUAGE_BY_LOCALE[locale]}.`,
    'This includes shortSummary, mainTopics, keyTensions, agreements, task titles, and suggestedNextMeetingFocus.',
    'Use that language even when the meeting data is written in another language.',
  ].join('\n');
}
```

Change `aiMeetingSummaryRequestSchema.locale` to `aiSummaryLocaleSchema.optional()` and add `buildOutputLanguageInstruction(locale)` to the array returned by `buildSummarySystemPrompt(templateId, locale)`. Preserve the existing safety and template instructions unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/summary-prompts.test.ts`

Expected: PASS; all three locale/language pairs have an explicit all-fields instruction.

- [ ] **Step 5: Check the type boundary**

Run: `npm run typecheck`

Expected: PASS; the request DTO infers `locale` as `en | uk | es | undefined`.

### Task 2: Wire locale into generation and protect the HTTP/cache contract

**Files:**
- Modify: `src/modules/ai/ai.service.ts:278-311`
- Modify: `tests/ai.service.test.ts:360-383, 517-535, 1258-1270`
- Modify: `tests/ai.routes.test.ts:185-199`

**Interfaces:**
- Consumes: `buildSummarySystemPrompt(templateId: string, locale: AiSummaryLocale)` from Task 1 and the existing `buildSummaryPromptPayload(meeting, participants, locale)`.
- Produces: a provider request whose `systemPrompt` explicitly names the selected output language, plus a 422 response for unsupported locale values.

- [ ] **Step 1: Write failing service and route tests**

```ts
await service.generateMeetingSummary(auth, { meetingId, locale: 'uk' }, new Date(now));
const providerCall = vi.mocked(provider.generateMeetingSummary).mock.calls[0]?.[0];
expect(providerCall?.systemPrompt).toContain('Write every user-visible output value in Ukrainian.');

const response = await app.inject({
  method: 'POST',
  url: '/v1/ai/meeting-summary',
  headers: { authorization: 'Bearer premium-token' },
  payload: { meetingId: '11111111-1111-4111-8111-111111111111', locale: 'pl' },
});
expect(response.statusCode).toBe(422);
expect(routeGenerateMeetingSummary).not.toHaveBeenCalled();
```

Replace the existing `pl` service inputs with supported `uk` or `es` values. Keep the cache test, but use `en` and `uk` so it continues to demonstrate distinct input hashes with valid public requests.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts`

Expected: FAIL because `ai.service.ts` still calls `buildSummarySystemPrompt(meeting.templateId)` without the locale and the route accepts `pl`.

- [ ] **Step 3: Pass the validated locale to the prompt builder**

```ts
const systemPrompt = buildSummarySystemPrompt(
  meeting.templateId,
  request.locale ?? 'en',
);
```

Keep `buildSummaryPromptPayload(meeting, participants, request.locale)` unchanged so the locale remains in the serialized payload. Compute `inputHash` only after creating this locale-specific prompt and payload, preserving cache isolation.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts`

Expected: PASS; Ukrainian prompt instruction reaches the provider, unsupported locale is rejected with the existing validation shape, and different supported locales receive distinct hashes.

- [ ] **Step 5: Run backend verification**

Run: `npm run typecheck; npm test`

Expected: PASS; all backend type and behavior tests pass without a schema migration.

### Task 3: Lock the frontend request to the active selected language

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiGenerationFlow.test.ts:18-35, 104-128`

**Interfaces:**
- Consumes: `i18n.global.locale.value` and `generateAiMeetingSummary(payload, options)`.
- Produces: regression coverage that the API request carries the active app locale.

- [ ] **Step 1: Write a failing frontend locale-forwarding test**

```ts
import { i18n } from '@/features/localization/i18n';

it.each(['en', 'uk', 'es'] as const)('sends the active %s app locale', async (locale) => {
  i18n.global.locale.value = locale;
  await generateMeetingSummary(source);
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ meetingId: source.id, locale }),
    expect.any(Object),
  );
});
```

Set the test locale back to `en` in `beforeEach` so other tests remain isolated.

- [ ] **Step 2: Run the focused frontend test to verify it passes**

Run: `npm test -- src/features/meeting/__tests__/aiGenerationFlow.test.ts`

Working directory: `D:/Projects/myself/weekly-us`

Expected: PASS; runtime code already forwards `i18n.global.locale.value` in `generateBackendAiSummary`.

- [ ] **Step 3: Run frontend verification**

Run: `npm run typecheck; npm test -- src/features/meeting/__tests__/aiGenerationFlow.test.ts`

Working directory: `D:/Projects/myself/weekly-us`

Expected: PASS; the test is type-safe and verifies the `en`, `uk`, and `es` request payloads.

- [ ] **Step 4: Leave changes ready for review**

Do not stage or commit. Report the modified API and frontend files plus every verification command and result. Create a commit only after the user explicitly approves an exact commit group and message.
