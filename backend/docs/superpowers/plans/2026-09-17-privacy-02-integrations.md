# AI and Google Calendar Privacy Disclosures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Give users an accurate account of what AI and Calendar send, receive, retain, and remove, backed by the actual feature flows.

**Architecture:** Keep public copy in the existing legal documents and contextual disclosure in the existing feature UI. Trace backend provider calls and storage before writing claims. Coordinate account-deletion provider cleanup with Plan 01 rather than building two cleanup implementations.

**Tech Stack:** Vue, TypeScript, Fastify, OpenAI SDK, Google APIs, Supabase, Vitest, Astro.

## Global Constraints

- Read the [index](2026-09-17-privacy-remediation-index.md). No secrets or production household content in evidence or fixtures.
- `store: false` does not prove zero provider retention. Do not promise zero retention, no model training, EU-only processing, or specific safeguards without current provider/account evidence.
- Do not widen OAuth scopes, change AI payload semantics, or add unnecessary consent screens as a side effect of copy editing.
- Canonical legal copy is currently English; feature UI supports `en`, `uk`, `es`.

## Files and responsibilities

- `MOBILE/src/features/legal/productionLegalContent.ts`: new dedicated privacy sections.
- `MOBILE/src/features/localization/messages.ts`: existing AI disclosure and Calendar explanation; preserve unrelated edits.
- `MOBILE/src/features/meeting/composables/useMeetingSession.ts`, `MOBILE/src/pages/MeetingPage.vue`: first-use disclosure control flow.
- `MOBILE/src/features/meeting/__tests__/aiGenerationFlow.test.ts`, `MOBILE/src/pages/__tests__/MeetingPage.test.ts`: request timing and cancellation tests.
- `MOBILE/src/pages/CalendarSyncPage.vue`, `MOBILE/src/features/calendar/services/calendarService.ts`: connect/disconnect UI.
- `API/src/modules/ai/summary-payload.ts`, `summary-source.ts`, `openai.client.ts`, `ai.service.ts`, `ai.repository.ts`: exact outbound and retained data.
- `API/src/modules/calendar/google-oauth.client.ts`, `calendar.service.ts`, `calendar.repository.ts`: OAuth grants, event fields, encrypted credentials, deletion behavior.
- `API/tests/ai.summary-payload.test.ts`, `openai.client.test.ts`, `google-calendar.client.test.ts`, `calendar.service.test.ts`: behavioral proof.
- `LANDING/src/pages/privacy.astro`, `terms.astro`; maintained root legal Markdown, if authoritative.
- Create `API/docs/integration-privacy-evidence.md`: redacted source/config references, provider terms review dates, and release decisions.

### Task 1: Trace AI processing and write the disclosure

**Interfaces:** no new public API. Existing `buildSummaryPromptPayload(meeting, participants, locale?)` creates the backend prompt payload; examine the actual serialized content and OpenAI request.

- [ ] Record all outbound fields, including selected participants, section contents, template/date/language metadata, task/agreement data, and any other context actually included. Confirm participant email and private-note content are excluded; do not infer this solely from the screen copy.
- [ ] Inspect AI request rows and meeting-summary storage, errors, logging, rate-limit/deduplication records, prompt caching settings if used, and provider request parameters. Distinguish generated output retained by OurWeek from provider retention.
- [ ] Verify first-use disclosure before every reachable initial generation path and all supported locales. Cancel must make no provider-triggering API request. Investigate account-switch persistence so one person's acknowledgement is not blindly attributed to another.
- [ ] Draft a dedicated section using this known factual core, then adapt the listed inputs to verified payload evidence:

```text
When you request an AI recap, OurWeek sends selected shared meeting content
and participant names through our backend to OpenAI to generate the recap.
Private notes are not included. Before first use, the app explains this
sharing and asks you to confirm. Generated recaps are saved with the meeting
and can be viewed by household members who have access to it. AI recaps can
be inaccurate; review them before relying on them.
```

- [ ] Add a separate provider-retention paragraph only after checking the applicable OpenAI API settings/terms. Explain remaining abuse-monitoring retention where applicable; do not equate consumer ChatGPT terms with this API integration. Link directly to the applicable provider source.
- [ ] Add or extend a fixture test that inserts distinctive fake private-note and email markers alongside shared content and asserts the actual outgoing request lacks the private markers. Preserve assertions that intended shared content remains.
- [ ] Add a UI test for first generation → disclosure → cancel → zero API calls, and confirm → one API call. Extend existing test helpers rather than duplicating the meeting composable.

### Task 2: Trace Calendar permissions and write the disclosure

**Interfaces:** existing provider methods `buildAuthorizationUrl`, `exchangeCode`, `upsertEvent`, `deleteEvent`, `revoke`; existing `disconnectGoogle(auth, now?)` is the normal disconnection path.

- [ ] Record the current scopes: `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/userinfo.email`. Explain the breadth of granted event permissions separately from the narrower operations actually performed; do not claim access is restricted by Google to OurWeek-created events.
- [ ] Map connection email, encrypted tokens, expiry, event IDs, selected calendar, titles, dates, times, recurrence, and any descriptions into exact stored/outbound categories. Identify who can see created events according to the user's Google Calendar sharing settings.
- [ ] Verify normal disconnect: mapped event removal, token revocation attempt, local credential removal, provider failure handling, and connection state. Distinguish switching sync off from disconnecting the Google account.
- [ ] Record the separate account-deletion gap: its current RPC clears credentials without calling the normal provider disconnect path. Hand the cleanup change to Plan 01; until verified, do not state that account deletion guarantees Google event removal or successful revocation.
- [ ] Draft a Calendar section that explains connected email and authorization tokens, chosen events sent to Google, server-side encrypted token storage, normal disconnect actions, provider-failure limitations, and how to revoke OurWeek in Google account settings.
- [ ] Check the current Google API/Workspace User Data and Limited Use requirements linked in the index. After verifying actual compliance, add the applicable statement and links. Do not treat inserting a compliance sentence as satisfying undisclosed underlying requirements.
- [ ] Extend Calendar tests for correct scopes, user/workspace ownership, mapped-event-only cleanup, absent/already revoked tokens, remote event already absent, revocation failure, and a second disconnect. No real provider calls in unit tests.

### Task 3: Publish consistent copy and verify the boundary

- [ ] Insert separate privacy sections named `AI summaries` and `Google Calendar`; do not bury detailed explanations inside a generic recipient list. Keep terms' accuracy warning concise and link to privacy for processing details.
- [ ] Update mobile and landing copy together. Ensure URLs in mobile text are usable; existing paragraphs render plain text, so a raw URL string is not a functioning link. If links are needed, add typed link metadata/rendering or a dedicated anchor, never `v-html` for legal strings.
- [ ] Use this minimal content test as a rendering smoke test, not legal-compliance proof:

```ts
it('provides dedicated integration explanations', () => {
  const headings = privacyPolicy.sections.map((section) => section.heading);
  expect(headings).toContain('AI summaries');
  expect(headings).toContain('Google Calendar');
});
```

- [ ] Run relevant AI/Calendar tests in both repositories. If runtime files changed, run API `npm run typecheck` and `npm test`; mobile `npm run build` and `npm run check`. Build landing if changed.
- [ ] Manually verify first-use disclosure, cancel, confirmation, reconnect, disconnect, and provider-failure messaging using synthetic accounts. Coordinate the account-deletion case with Plan 01.
- [ ] Send verified categories and open production questions to Plan 06; do not mark unresolved provider retention as complete.

**Acceptance:** policy, first-use disclosure, provider payloads, and disconnect behavior describe the same facts; private notes stay excluded; broad permissions are not understated; no unsupported retention/training or revocation promises remain.
