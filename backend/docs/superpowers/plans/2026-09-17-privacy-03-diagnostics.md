# Diagnostics Transparency and Data Minimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Describe when Sentry runs and what it receives accurately, and close any confirmed sensitive-content leaks found while verifying that description.

**Architecture:** Keep initialization at existing entry points and introduce narrow, testable event sanitizers only if the audit demonstrates a gap. Treat mobile monitoring, backend monitoring, and infrastructure logs as distinct flows. Reuse existing redaction utilities where they actually cover the event path.

**Tech Stack:** TypeScript, `@sentry/vue` and `@sentry/node` 10.71.0 at review time, Vue, Fastify/Pino, Vitest.

## Global Constraints

- Read the [index](2026-09-17-privacy-remediation-index.md). Verify installed versions and official SDK option support before changing initialization.
- DSN presence is configuration, not user consent. Do not invent a legal requirement for opt-in or silently choose a lawful basis.
- `sendDefaultPii: false` and existing `dataCollection` settings are not proof that all personal content is excluded from all event fields.
- Do not disable all monitoring or log raw events from real users to demonstrate safety.

## File map

- `MOBILE/src/main.ts`: Sentry initialization conditional on `VITE_SENTRY_DSN`.
- `MOBILE/src/shared/services/errorMonitoringService.ts`: handles errors and extras; native `Error` currently goes directly to `captureException`.
- `MOBILE/src/shared/services/redactionService.ts`: key-based redaction; free text under innocuous keys can escape a key-only approach.
- `API/src/instrument.ts`: backend Sentry initialization, `sendDefaultPii: false`, no tracing.
- `API/src/shared/errors/error-handler.ts`, `API/tests/error-handler.sentry.test.ts`: exception reporting.
- `API/src/shared/logging/pino-options.ts`: application log redaction, separate from Sentry.
- Proposed if needed: `MOBILE/src/shared/services/sentryPrivacy.ts`, `MOBILE/src/shared/services/__tests__/sentryPrivacy.test.ts`, `API/src/shared/logging/sentry-privacy.ts`, `API/tests/sentry-privacy.test.ts`.
- Copy: mobile legal content/tests and `LANDING/src/pages/privacy.astro`.
- Create `API/docs/diagnostics-privacy-evidence.md` for environment/settings and sanitized event evidence.

### Task 1: Determine the actual data flow

- [ ] Check installed SDK types and official docs for `dataCollection`, `beforeSend`, breadcrumb hooks, default integrations, IP handling, request capture, session data, and error messages. Do not assume options from one SDK work in the other.
- [ ] Inspect mobile/backend production configuration without printing secrets. Record only monitoring enabled/disabled, provider region, retention duration, access roles, and whether attachments/replay/tracing/profiling/log ingestion are enabled.
- [ ] Trace all explicit capture calls plus automatic exception/breadcrumb paths. Include OAuth callback URLs, query strings, request IDs, household IDs, user IDs, stack frames, device/runtime data, and application-generated exception text.
- [ ] Use a mocked transport or in-memory hooks with synthetic marker values to inspect the full outbound envelope. Test strings embedded in exception messages, URLs, breadcrumbs, tags, extras, nested causes, and request metadata. Do not send sensitive fixtures to a real project.
- [ ] Document Pino/hosting log retention separately; redaction for Sentry does not establish redaction for reverse proxies or infrastructure logs.

### Task 2: Harden only demonstrated unsafe paths

**Proposed interface when required:** `sanitizeSentryEvent(event: ErrorEvent): ErrorEvent | null`, using the installed SDK's event type in each repository. It returns an allowed diagnostic event or drops it; it does not mutate source application objects.

- [ ] Write a failing fixture test before adding filtering. Example for a sanitizer exported under the proposed interface:

```ts
it('removes secrets from exception and request fields', () => {
  const output = sanitizeSentryEvent({
    exception: { values: [{ type: 'Error', value: 'private-note-SECRET' }] },
    request: { url: 'https://example.invalid/callback?code=oauth-SECRET' },
    extra: { payload: { note: 'private-note-SECRET' } },
    user: { email: 'secret@example.invalid' },
  });
  expect(output).not.toBeNull();
  expect(JSON.stringify(output)).not.toContain('SECRET');
  expect(JSON.stringify(output)).not.toContain('secret@example.invalid');
});
```

- [ ] Use an explicit allowed-field policy for risky free-text fields. Keep useful safe error category, release/environment, sanitized stack metadata and route pattern; redact/drop raw exception messages, request bodies/headers/query fragments, household content, arbitrary extras and personal identifiers unless a reviewed purpose explicitly allows them.
- [ ] Ensure OAuth paths/query strings, unknown third-party error objects and nested causes cannot bypass the sanitizer. Preserve bounded diagnostics for debugging; do not replace every event with an empty object.
- [ ] Wire the sanitizer at the final event boundary and the applicable breadcrumb boundary. Test automatic errors as well as `captureHandledError` and API `captureException`.
- [ ] Confirm filtering doesn't throw on circular/non-JSON inputs and doesn't leak the original event through fallback logging. If SDK types restrict inputs, test unsupported values at the actual capture boundary.
- [ ] Add tests that DSN absent means no initialization/network submission and DSN configured initializes once. Do not add an opt-in toggle unless the legal/product decision requires one; if it does, prevent pre-consent initialization and stop subsequent capture on withdrawal.

### Task 3: Correct disclosure and verify configuration

- [ ] Add a dedicated `Diagnostics` privacy section. Explain monitoring may operate automatically when enabled for the deployed app/service, the verified technical/error categories, purpose, provider, and confirmed retention or retention criteria. Avoid implying users turn it on by using a feature.
- [ ] Have the legal reviewer select and document the purpose-specific lawful basis and applicable controls. Distinguish objection rights from consent withdrawal; do not label all processing as consent-based.
- [ ] Update the data inventory through Plan 06. Name separate storage/retention for backend logs, Sentry, and support copies.
- [ ] Run focused sanitizer/initialization/error-handler tests, API `npm run typecheck` and `npm test`, mobile `npm run build` and `npm run check`; landing build if changed.
- [ ] Verify a synthetic production-like event contains useful diagnostics but none of the planted content markers, using a test environment only. Record provider-side configuration evidence without attachments containing real event content.

**Acceptance:** users can tell when diagnostics run; actual SDK behavior supports the stated categories and exclusions; no zero-PII claim rests solely on an SDK flag; production retention/settings are recorded or explicitly pending.
