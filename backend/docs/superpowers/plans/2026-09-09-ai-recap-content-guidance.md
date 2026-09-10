# AI Recap Content Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn before an AI recap consumes a credit for a completed meeting with too little shared discussion context, while preserving an explicit “generate anyway” choice.

**Architecture:** Add the same small deterministic readiness rule on both sides of the existing API boundary. The Vue client evaluates the completed meeting before every user-initiated recap, uses the existing bottom-sheet confirmation pattern to collect an override, and sends that override to the API. The Fastify service independently evaluates sanitized shared content before creating a generation claim, returning a safe 422 unless the explicit override is present.

**Tech Stack:** Vue 3, TypeScript, Pinia, vue-i18n, Vitest, Fastify, Zod, Supabase-backed AI request repository.

## Global Constraints

- A recap is ready only with at least `2` non-empty shared notes or agreements across at least `2` distinct sections.
- Tasks enrich a recap but never count as discussion signals by themselves.
- Do not require content in every template section, score content quality, alter prompts/models, alter quotas, or change private-note behavior.
- Private-marked records must not count on the server and must never appear in API errors or logs.
- A low-content recap remains possible only after the person selects `Generate anyway`; the server-side override field is optional and defaults to no override.
- Reuse `ConfirmationDialog.vue`; do not add a modal implementation or a dependency.
- Add all English, Ukrainian, and Spanish copy in `src/features/localization/messages.ts`.
- Do not stage or commit. The user has not authorized a commit.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `D:/Projects/myself/weekly-us-api/src/modules/ai/summary-payload.ts` | Derive content-readiness counts from the same sanitized, shared sections used in the provider payload. |
| `D:/Projects/myself/weekly-us-api/src/modules/ai/ai.schema.ts` | Validate the optional low-content override on the recap request. |
| `D:/Projects/myself/weekly-us-api/src/modules/ai/ai.service.ts` | Reject an unconfirmed low-content generation before any claim, credit reservation, or provider call. |
| `D:/Projects/myself/weekly-us-api/tests/ai.summary-payload.test.ts` | Prove private markers and malformed/empty records cannot create readiness signals. |
| `D:/Projects/myself/weekly-us-api/tests/ai.service.test.ts` | Prove rejection order, safe error details/logging, and explicit override behavior. |
| `D:/Projects/myself/weekly-us-api/tests/ai.routes.test.ts` | Prove the route accepts/passes a boolean override and rejects a non-boolean one. |
| `D:/Projects/myself/weekly-us-api/docs/openapi.json` | Generated public request-contract artifact. |
| `D:/Projects/myself/weekly-us/src/features/meeting/aiRecapContentReadiness.ts` | Pure client-side readiness calculation for all recap entry points. |
| `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiRecapContentReadiness.test.ts` | Unit coverage for the client rule and its edge cases. |
| `D:/Projects/myself/weekly-us/src/shared/api/aiApi.ts` | Declare the additive `allowLowContent` request field. |
| `D:/Projects/myself/weekly-us/src/features/meeting/aiSummaryService.ts` | Forward an explicit low-content override through the current sync/API flow. |
| `D:/Projects/myself/weekly-us/src/pages/MeetingSummaryPage.vue` | Guard recap generation from the summary page with a confirmation sheet. |
| `D:/Projects/myself/weekly-us/src/pages/MeetingDetailsPage.vue` | Apply the identical guard from the history/details page. |
| `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts` | Apply the guard before first-use privacy disclosure after meeting completion. |
| `D:/Projects/myself/weekly-us/src/pages/MeetingPage.vue` | Render the completion-flow confirmation sheet using the existing component. |
| `D:/Projects/myself/weekly-us/src/features/localization/messages.ts` | Translation-ready low-content confirmation copy. |
| `D:/Projects/myself/weekly-us/src/shared/api/__tests__/apiWrappers.test.ts` | Prove the override serialization. |
| `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiSummaryService.test.ts` | Prove service request options reach the API wrapper. |
| `D:/Projects/myself/weekly-us/src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts` | Prove low-content completion does not generate until confirmed and preserves privacy disclosure order. |
| `D:/Projects/myself/weekly-us/src/pages/__tests__/MeetingRecapPages.test.ts` | Prove both recap page buttons show the sheet, cancel without calling the generator, and confirm with an override. |

---

### Task 1: Establish the server’s private-safe readiness primitive

**Files:**
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/ai/summary-payload.ts`
- Modify: `D:/Projects/myself/weekly-us-api/tests/ai.summary-payload.test.ts`

**Interfaces:**
- Produces: `SUMMARY_MIN_DISCUSSION_SIGNALS = 2`, `SUMMARY_MIN_DISCUSSION_SECTIONS = 2`, and `getSummaryContentReadiness(sections: JsonValue[]): { isReady: boolean; discussionSignalCount: number; sectionCount: number }`.
- Consumes: existing `sanitizeNotes`, `sanitizeAgreements`, `sanitizeSectionsForAi`, and `isPrivateMarkedObject` behavior.
- Used by: Task 2 before AI request claiming.

- [ ] **Step 1: Write the failing payload tests**

Add table-driven cases that call `getSummaryContentReadiness(meeting({ sections }).sections)` and assert the exact return value:

```ts
expect(getSummaryContentReadiness([{
  id: 'one', notes: [{ text: 'Plan pickup.' }], tasks: [], agreements: [],
}, {
  id: 'two', notes: [], tasks: [], agreements: [{ text: 'Alternate weeks.' }],
}])).toEqual({ isReady: true, discussionSignalCount: 2, sectionCount: 2 });

expect(getSummaryContentReadiness([{
  id: 'one', notes: [{ text: 'Plan pickup.' }, { text: 'Book dentist.' }], tasks: [], agreements: [],
}])).toEqual({ isReady: false, discussionSignalCount: 2, sectionCount: 1 });
```

Also assert: one task in each of two sections remains not ready; whitespace-only note/agreement text is ignored; private notes and agreements are ignored even when a private item would otherwise make the second section qualify.

- [ ] **Step 2: Run the focused payload test to verify the missing export fails**

Run from `D:/Projects/myself/weekly-us-api`:

```powershell
npm test -- tests/ai.summary-payload.test.ts
```

Expected: FAIL because `getSummaryContentReadiness` and its constants do not exist.

- [ ] **Step 3: Implement one sanitization-backed readiness calculation**

Keep `sanitizeSectionsForAi` as the single point that removes malformed and private items. Export a function that iterates its result, increments the signal count by `section.notes.length + section.agreements.length`, and increments the section count once when that sum is positive. Return:

```ts
return {
  isReady: discussionSignalCount >= SUMMARY_MIN_DISCUSSION_SIGNALS
    && sectionCount >= SUMMARY_MIN_DISCUSSION_SECTIONS,
  discussionSignalCount,
  sectionCount,
};
```

Do not call `buildSummaryPromptPayload`, stringify meeting data, inspect task fields, or add character-quality heuristics.

- [ ] **Step 4: Run the focused payload tests**

Run:

```powershell
npm test -- tests/ai.summary-payload.test.ts
```

Expected: PASS, including existing proof that private content is excluded from the provider payload.

### Task 2: Enforce the explicit server override before AI work begins

**Files:**
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/ai/ai.schema.ts`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/ai/ai.service.ts`
- Modify: `D:/Projects/myself/weekly-us-api/tests/ai.service.test.ts`
- Modify: `D:/Projects/myself/weekly-us-api/tests/ai.routes.test.ts`
- Modify: `D:/Projects/myself/weekly-us-api/docs/openapi.json` (generated)

**Interfaces:**
- Consumes: `getSummaryContentReadiness()` and its exported minimum constants from Task 1.
- Produces: optional `allowLowContent?: boolean` in `AiMeetingSummaryRequestDto`.
- Produces: `422 ai_summary_insufficient_content` with scalar readiness counts only.
- Used by: the existing mobile API wrapper in Task 3.

- [ ] **Step 1: Add failing service and route tests**

In `tests/ai.service.test.ts`, build a completed meeting with one shared note and one task in the same section. Assert this unconfirmed request rejects with:

```ts
{
  statusCode: 422,
  code: 'ai_summary_insufficient_content',
  details: {
    discussionSignalCount: 1,
    sectionCount: 1,
    requiredDiscussionSignalCount: 2,
    requiredSectionCount: 2,
  },
}
```

Assert `participants.listParticipantNamesForWorkspace`, `ai.claimSummaryGeneration`, `assistant.reserveRecap`, and `provider.generateMeetingSummary` were not called. Include a logger assertion that contains counts and IDs but does not contain the test note text. Add a second test that passes `allowLowContent: true` and asserts the normal provider/claim path runs.

In `tests/ai.routes.test.ts`, submit a successful route payload containing `allowLowContent: true` and assert the mock service receives the field. Add a request with `allowLowContent: 'true'` and assert `422 validation_failed` with no service invocation.

- [ ] **Step 2: Run the focused server tests and confirm failure**

Run:

```powershell
npm test -- tests/ai.service.test.ts tests/ai.routes.test.ts
```

Expected: FAIL because the schema strips/rejects the unknown field and the service does not return `ai_summary_insufficient_content`.

- [ ] **Step 3: Add the contract and short-circuit**

Extend `aiMeetingSummaryRequestSchema` exactly as follows:

```ts
allowLowContent: z.boolean().optional(),
```

In `AiSummaryService.generateMeetingSummary`, after the completed-meeting check and before abandoned-recap reconciliation, participant lookup, prompt construction, `claimSummaryGeneration`, or allowance reservation, calculate readiness from `meeting.sections`. If it is not ready and `request.allowLowContent !== true`, write the existing structured rejection log with `reason: 'insufficient_content'`, only IDs/template/model/counts/minima, then throw:

```ts
throw new ApiError(422, 'ai_summary_insufficient_content',
  'Add more meeting context before generating a recap.', {
    discussionSignalCount: readiness.discussionSignalCount,
    sectionCount: readiness.sectionCount,
    requiredDiscussionSignalCount: SUMMARY_MIN_DISCUSSION_SIGNALS,
    requiredSectionCount: SUMMARY_MIN_DISCUSSION_SECTIONS,
  });
```

Do not persist the override, include it in the input hash, or pass it to the provider. A confirmed low-content request otherwise stays on the current code path.

- [ ] **Step 4: Regenerate and test the server contract**

Run:

```powershell
npm test -- tests/ai.summary-payload.test.ts tests/ai.service.test.ts tests/ai.routes.test.ts
npm run typecheck
npm run openapi:generate
npm run openapi:check
```

Expected: all commands PASS; `docs/openapi.json` contains an optional boolean `allowLowContent` on the `POST /v1/ai/meeting-summary` request schema.

### Task 3: Add the client’s reusable readiness check and explicit transport option

**Files:**
- Create: `D:/Projects/myself/weekly-us/src/features/meeting/aiRecapContentReadiness.ts`
- Create: `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiRecapContentReadiness.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/aiApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/aiSummaryService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/__tests__/aiSummaryService.test.ts`

**Interfaces:**
- Produces: `getAiRecapContentReadiness(meeting: Meeting): AiRecapContentReadiness` with the same two/minimum rule as Task 1.
- Produces: `generateMeetingSummary(meeting: Meeting, options?: { allowLowContent?: boolean })`.
- Consumes: existing `GenerateMeetingSummaryRequestDto` and completed-meeting sync flow.
- Used by: Task 4 and Task 5 entry-point guards.

- [ ] **Step 1: Write the failing client readiness and API-wrapper tests**

Define the client expected type and tests:

```ts
expect(getAiRecapContentReadiness(meetingWithTwoNotesInTwoSections)).toEqual({
  isReady: true, discussionSignalCount: 2, sectionCount: 2,
});
expect(getAiRecapContentReadiness(meetingWithTaskAndOneNote)).toEqual({
  isReady: false, discussionSignalCount: 1, sectionCount: 1,
});
```

Cover two notes in one section, a note plus agreement across two sections, and task-only sections. In `apiWrappers.test.ts`, call `generateAiMeetingSummary({ meetingId: 'meeting-1', allowLowContent: true })` and assert the exact API body contains `allowLowContent: true`. In the AI-summary service test, mock the API wrapper and assert `{ allowLowContent: true }` reaches it after sync while the default call omits it.

- [ ] **Step 2: Run the focused client tests and confirm failure**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/__tests__/aiRecapContentReadiness.test.ts src/shared/api/__tests__/apiWrappers.test.ts src/features/meeting/__tests__/aiSummaryService.test.ts
```

Expected: FAIL because the readiness helper and option do not exist.

- [ ] **Step 3: Implement the shared client primitives**

Create `aiRecapContentReadiness.ts` with exported constants `AI_RECAP_MIN_DISCUSSION_SIGNALS = 2` and `AI_RECAP_MIN_DISCUSSION_SECTIONS = 2`. Traverse `meeting.sections`; count only `note.text.trim()` and `agreement.text.trim()`; add a section to the count once it has at least one signal. Do not inspect tasks, template labels, or participant names.

Extend the API DTO with `allowLowContent?: boolean`. Extend the internal `generateBackendAiSummary` and exported `generateMeetingSummary` with an optional `{ allowLowContent?: boolean }` option, and add the field to the API body only when it is true:

```ts
...(options.allowLowContent ? { allowLowContent: true } : {}),
```

Keep the default and all existing callers behaviorally unchanged.

- [ ] **Step 4: Run the focused client tests**

Run:

```powershell
npm test -- src/features/meeting/__tests__/aiRecapContentReadiness.test.ts src/shared/api/__tests__/apiWrappers.test.ts src/features/meeting/__tests__/aiSummaryService.test.ts
```

Expected: PASS; an ordinary recap request sends no override and a confirmed one sends only `true`.

### Task 4: Guard recap generation from the two completed-meeting screens

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingSummaryPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingDetailsPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/__tests__/MeetingRecapPages.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`

**Interfaces:**
- Consumes: `getAiRecapContentReadiness()` and `generateMeetingSummary(meeting, { allowLowContent: true })` from Task 3.
- Consumes: `ConfirmationDialog` and new `ai.recap.lowContent` translations.
- Produces: one local pending-meeting state and a confirmation sheet per page, without adding global state.
- Used by: people opening a completed meeting from history or a newly completed meeting’s summary screen.

- [ ] **Step 1: Write failing page-level interaction tests**

In `MeetingRecapPages.test.ts`, mount each page with a completed low-content fixture and available recap allowance. Trigger `[data-testid="generate-meeting-recap"]`; assert a `ConfirmationDialog` with the low-content title/body is visible and `generateMeetingSummary` has not been called. Trigger its cancel action; assert it remains uncalled. Reopen, trigger `Generate anyway`, and assert:

```ts
expect(generateMeetingSummary).toHaveBeenCalledWith(
  expect.objectContaining({ id: 'meeting-1' }),
  { allowLowContent: true }
);
```

Add the companion ready-content case that directly invokes the generator without rendering the low-content sheet. Preserve existing loading/error/allowance tests.

- [ ] **Step 2: Run page tests and confirm failure**

Run:

```powershell
npm test -- src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: FAIL because neither page computes readiness or renders the confirmation.

- [ ] **Step 3: Add calm copy and one shared local interaction pattern**

Add this three-key group to `ai.recap` for English and accurate Ukrainian/Spanish equivalents:

```ts
lowContent: {
  title: 'Add a little more context?',
  body: 'Recaps work best when two different parts of the meeting include a note or agreement. You can still generate one now.',
  addMore: 'Add more context',
  generateAnyway: 'Generate anyway',
},
```

In each page, add `isLowContentConfirmationOpen` and a `pendingLowContentMeeting`/ID ref. Change the existing button handler to:

1. retain every current completion, entitlement, existing-summary, recovery, and loading guard;
2. evaluate `getAiRecapContentReadiness(meeting)`;
3. open the confirmation and return when it is not ready;
4. otherwise call the existing generator normally.

Render `ConfirmationDialog` beside the page’s existing recap UI. Its close action clears pending state without changing the meeting. Its confirm action clears the sheet and calls the same generation function with `{ allowLowContent: true }`. Set the dialog `loading` prop while a confirmed generation is in flight so duplicate taps and Android back cannot start another request.

- [ ] **Step 4: Run page tests and formatting checks**

Run:

```powershell
npm test -- src/pages/__tests__/MeetingRecapPages.test.ts
npm run check
```

Expected: PASS; both screens give the same guidance and retain normal ready-meeting behavior.

### Task 5: Preserve the completion flow and privacy-disclosure order

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts`

**Interfaces:**
- Consumes: Task 3 readiness helper and generator option; Task 4 translations.
- Consumes: the existing `isAiRecapDisclosureOpen`, `pendingAiRecapDisclosureMeetingId`, and `ConfirmationDialog` flow.
- Produces: `isAiRecapLowContentOpen`, `confirmAiRecapLowContent`, and `deferAiRecapLowContent` from `useMeetingSession`.
- Used by: `MeetingPage.vue` after a meeting is successfully marked completed.

- [ ] **Step 1: Extend completion-flow tests before changing the composable**

Add a low-content fixture to `meetingRecapCompletion.test.ts`. After `finishMeeting()` assert the meeting is completed, the low-content sheet is open, `isAiRecapDisclosureOpen` is false, and no generator call happened. Then assert:

```ts
await session.deferAiRecapLowContent();
expect(generateMeetingSummary).not.toHaveBeenCalled();
expect(push).toHaveBeenCalledWith(expect.objectContaining({ name: 'meeting-summary' }));
```

In a separate case, call `confirmAiRecapLowContent()` with first-use disclosure unacknowledged. Assert the low-content sheet closes and the existing privacy disclosure opens without generating. Then call `confirmAiRecapDisclosure()` and assert the generator is called with `{ allowLowContent: true }`. Add an acknowledged-disclosure case that confirms low content and directly generates with the override.

- [ ] **Step 2: Run the completion test and confirm failure**

Run:

```powershell
npm test -- src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts
```

Expected: FAIL because the low-content state and handlers do not exist.

- [ ] **Step 3: Insert the quality confirmation before the privacy confirmation**

Add a pending low-content override boolean/ref scoped to the current completion. Immediately after `meetingsStore.finishMeeting()` succeeds, evaluate the just-completed meeting. If recap allowance is available and readiness is false, store its ID, open `isAiRecapLowContentOpen`, and return.

`deferAiRecapLowContent` must clear state and call `continueCompletedMeeting(meetingId, false)` so completion and navigation remain successful. `confirmAiRecapLowContent` must preserve the pending override. If privacy has not been acknowledged, open the existing disclosure next; otherwise call `continueCompletedMeeting(meetingId, true, { allowLowContent: true })`.

Adapt `confirmAiRecapDisclosure` to read the pending override and pass it to `continueCompletedMeeting`. Extend `continueCompletedMeeting` to accept `generationOptions?: { allowLowContent?: boolean }` and forward those only to `generateMeetingSummary`. Always clear pending low-content state after it is consumed or dismissed; never retain it across meetings.

In `MeetingPage.vue`, render a second `ConfirmationDialog` before the privacy disclosure dialog, bound to the new session properties and `ai.recap.lowContent` copy. Keep `Add more context` as the non-destructive close label and `Generate anyway` as the confirm label.

- [ ] **Step 4: Run completion regression tests**

Run:

```powershell
npm test -- src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts
```

Expected: PASS; normal completion remains unchanged, low content never consumes a recap on dismissal, and first-use privacy notice still occurs before any provider-bound request.

### Task 6: Run cross-repository verification and review the contract diff

**Files:**
- Verify only; no new source files.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: evidence that web UI, API contract, types, and regression suites agree.

- [ ] **Step 1: Run focused cross-repository tests**

Run from `D:/Projects/myself/weekly-us-api`:

```powershell
npm test -- tests/ai.summary-payload.test.ts tests/ai.service.test.ts tests/ai.routes.test.ts tests/openapi.test.ts
npm run typecheck
npm run build
npm run openapi:check
```

Then run from `D:/Projects/myself/weekly-us`:

```powershell
npm test -- src/features/meeting/__tests__/aiRecapContentReadiness.test.ts src/features/meeting/__tests__/aiSummaryService.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingRecapPages.test.ts src/shared/api/__tests__/apiWrappers.test.ts
npm run build
npm run check
```

Expected: every command PASS.

- [ ] **Step 2: Manually test the mobile flow**

On Android or a narrow device viewport, complete three meetings: (1) task-only/one-note content, dismiss the warning, and confirm no recap is created; (2) the same low-content meeting, choose `Generate anyway`, and confirm the privacy disclosure then one recap request; (3) two notes or agreements in two sections, and confirm normal generation without the quality sheet. Verify the bottom sheet is legible with the keyboard dismissed and Android back closes it before navigating.

- [ ] **Step 3: Inspect additive API and privacy safety**

Review the generated `docs/openapi.json` request body to ensure `allowLowContent` is optional boolean only. Inspect test snapshots/log assertions to ensure no raw note, agreement, private marker, participant name, prompt payload, or override state is added to API error details or logs. Confirm `git diff --check` passes in each repository before proposing any commit.

---

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 implement the private-safe, pre-credit API guard; Tasks 3–5 cover every client entry point, the explicit override, all locales, and the required first-use privacy ordering; Task 6 verifies both projects and Android behavior.
- **No placeholder scan:** No `TBD`, `TODO`, deferred implementation, or unspecified test instruction remains; each task contains exact file paths, interfaces, test expectations, and commands.
- **Type consistency:** The sole wire name is `allowLowContent`; the server DTO, API wrapper, generation-service option, page confirmation, and completion flow all use that name. The scalar readiness fields and minimum constants use the same names throughout.
