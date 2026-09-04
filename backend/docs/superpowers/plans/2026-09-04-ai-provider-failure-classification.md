# AI Provider Failure Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify OpenAI meeting-summary failures into safe internal categories and structured diagnostic fields while retaining the existing generic provider-failure API response.

**Architecture:** The OpenAI adapter owns SDK/Responses-response inspection and exposes a typed, metadata-only internal failure. The summary service turns that failure (and domain output-schema failures) into a safe request-audit code and structured log event, then preserves the existing cleanup and `503 ai_summary_generation_failed` mobile contract.

**Tech Stack:** Node.js 24, TypeScript 7, Fastify, OpenAI Node SDK 7.5.0 Responses API, Vitest 4.

## Global Constraints

- Keep every provider-originated client response at `503 ai_summary_generation_failed` with `AI summaries are not available right now.`
- Do not add a migration, dependency, provider request, deployment change, mobile change, automatic retry, or alerting integration.
- Keep the SDK configuration at `timeout: 15_000` and `maxRetries: 1`; it must remain below the mobile 45-second abort budget.
- Never log or return prompts, meeting content, API keys, authorization headers, raw provider bodies, raw SDK errors, or raw provider error messages.
- Preserve workspace authorization, existing request/credit cleanup, AI-06 recovery, and AI-07 finalization-uncertainty behavior.
- Do not stage, commit, push, or edit the user-modified root review/checklist files as part of this work.

---

## File structure

- `src/modules/ai/openai.client.ts` — owns provider result metadata, typed safe provider failures, OpenAI SDK/error classification, and Responses terminal-state inspection.
- `src/modules/ai/ai.service.ts` — maps safe provider/domain-output classifications into request auditing and structured logs while returning the unchanged client error.
- `src/modules/ai/mock-ai.client.ts` — satisfies the expanded provider-success result contract without fabricating provider diagnostics.
- `src/modules/ai/ai.routes.ts` — keeps the configured-unavailable provider behavior structurally compatible with the expanded provider contract.
- `tests/openai.client.test.ts` — mocks Responses SDK results/errors and verifies adapter classification, metadata, parsing, and sensitive-data boundaries.
- `tests/ai.service.test.ts` — verifies service audit/log mapping, generic client response, cleanup, and privacy boundaries.
- `tests/ai.routes.test.ts` — updates typed provider fixture expectations only if the expanded result contract makes an existing fixture incomplete.

## Task 1: Define the safe provider contract and regression-test adapter classification

**Files:**
- Modify: `tests/openai.client.test.ts`
- Modify: `src/modules/ai/openai.client.ts`
- Modify: `src/modules/ai/mock-ai.client.ts`
- Modify: `src/modules/ai/ai.routes.ts`
- Test: `tests/openai.client.test.ts`

**Interfaces:**
- Consumes: OpenAI SDK 7.5.0 `APIError` fields `status`, `code`, and `requestID`; connection error classes; Responses fields `status`, `error`, `incomplete_details`, `output`, `output_text`, `usage`, and optional `_request_id`.
- Produces: `AiSummaryProviderResult` with `output`, `usage`, `providerRequestId`, and `providerDurationMs`; `AiSummaryProviderFailureClass`; `AiSummaryProviderError`; and `isAiSummaryProviderError(error)`.

- [ ] **Step 1: Add failing OpenAI-adapter fixtures**

In `tests/openai.client.test.ts`, add a reusable completed response fixture with a safe `_request_id`, usage, and the existing valid JSON. Add separate `responsesCreate` fixtures for a response error, an incomplete response, a refusal output item, empty output, malformed JSON, and SDK-shaped errors with `status`, `code`, `requestID`, and deliberately sensitive `message`/body values. Add assertions equivalent to:

```ts
await expect(provider.generateMeetingSummary(input)).rejects.toMatchObject({
  name: 'AiSummaryProviderError',
  metadata: {
    failureClass: 'quota_exhausted',
    status: 429,
    providerCode: 'insufficient_quota',
    providerRequestId: 'req_safe_quota',
    model: 'gpt-5.4-nano',
  },
});

expect(JSON.stringify(error)).not.toContain('prompt-secret-123');
expect(JSON.stringify(error)).not.toContain('sk-secret-123');
expect(JSON.stringify(error)).not.toContain('raw-provider-body-secret');
```

Cover these exact expected classifications: `quota_exhausted` for known quota
codes, `authentication_or_configuration` for `401`, `403`, and known model
configuration `400` codes, `rate_limited` for non-quota `429` or a Responses
`rate_limit_exceeded` error, `timeout_or_network` for connection/timeout
errors, `provider_unavailable` for other provider HTTP/response errors,
`refused` for a `refusal` output part, `incomplete_output` for status
`incomplete`, and `invalid_structured_output` for empty/malformed JSON.

Extend the success assertions to require `providerRequestId: 'req_safe_ok'`
and a non-negative `providerDurationMs`, and keep the existing timeout/retry
configuration assertion.

- [ ] **Step 2: Run the adapter test to confirm the missing contract fails**

Run: `npm test -- tests/openai.client.test.ts`

Expected: FAIL because `AiSummaryProviderError`, safe response metadata, and
terminal-state classification do not yet exist.

- [ ] **Step 3: Implement the provider contract and classifier**

In `src/modules/ai/openai.client.ts`, add these public types immediately after
`AiSummaryTokenUsage`:

```ts
export type AiSummaryProviderFailureClass =
  | 'quota_exhausted'
  | 'authentication_or_configuration'
  | 'rate_limited'
  | 'timeout_or_network'
  | 'provider_unavailable'
  | 'refused'
  | 'incomplete_output'
  | 'invalid_structured_output';

export type AiSummaryProviderFailureMetadata = {
  failureClass: AiSummaryProviderFailureClass;
  status: number | null;
  providerCode: string | null;
  providerRequestId: string | null;
  model: string;
  durationMs: number;
  usage: AiSummaryTokenUsage | null;
};

export class AiSummaryProviderError extends Error {
  constructor(public readonly metadata: AiSummaryProviderFailureMetadata) {
    super('AI summary provider request failed.');
    this.name = 'AiSummaryProviderError';
  }
}

export function isAiSummaryProviderError(error: unknown): error is AiSummaryProviderError {
  return error instanceof AiSummaryProviderError;
}
```

Expand `AiSummaryProviderResult` with:

```ts
providerRequestId: string | null;
providerDurationMs: number;
```

Add private helpers that (a) normalize only finite non-negative token values,
(b) read a string `_request_id` from a successful response without serializing
the response, (c) scan `output` for a content item whose `type` is `refusal`,
and (d) turn a caught SDK error into metadata without copying `message`,
`headers`, `error`, `cause`, or any response body. Use `OpenAI` error classes
where available and a narrow structural guard for the documented safe
`status`/`code`/`requestID` fields so mocked and real SDK errors take the same
path.

Inside `generateMeetingSummary`, capture `startedAtMs` immediately before
`responses.create`. Wrap only the provider call and provider-response
interpretation in `try/catch`. Before `JSON.parse`, reject these terminal
states in this order: `response.error`, `response.status === 'incomplete'`, a
refusal output item, and an empty `output_text`. JSON parsing failure is also
converted to `AiSummaryProviderError`. For every adapter-originated failure,
construct metadata from safe scalar fields, `input.model`, elapsed time, and
available usage; then throw the typed error. Return successful output, usage,
safe request ID, and duration.

Classify status/code pairs with a closed mapping:

```ts
if (status === 429 && isQuotaCode(providerCode)) return 'quota_exhausted';
if (status === 429 || providerCode === 'rate_limit_exceeded') return 'rate_limited';
if (status === 401 || status === 403 || isModelConfigurationCode(providerCode)) {
  return 'authentication_or_configuration';
}
if (isConnectionOrTimeoutError(error)) return 'timeout_or_network';
return 'provider_unavailable';
```

Keep the existing strict JSON schema request, `store: false`, timeout, and
retry settings exactly unchanged. Update `MockAiSummaryProvider` to return
`providerRequestId: null` and `providerDurationMs: 0`. Update the unavailable
provider in `ai.routes.ts` only if TypeScript requires it; it should still
throw its existing `ai_provider_not_configured` `ApiError`, not a provider
failure.

- [ ] **Step 4: Run focused adapter tests**

Run: `npm test -- tests/openai.client.test.ts`

Expected: PASS with all success, SDK-error, response-error, refusal,
incomplete-output, malformed-output, timeout/retry, and sensitive-data
assertions passing.

## Task 2: Map safe provider/domain-output failures in the summary service

**Files:**
- Modify: `tests/ai.service.test.ts`
- Modify: `src/modules/ai/ai.service.ts`
- Test: `tests/ai.service.test.ts`

**Interfaces:**
- Consumes: `AiSummaryProviderError.metadata`, expanded successful
  `AiSummaryProviderResult`, `ApiError`, and the existing
  `markSummaryRequestFailed(workspaceId, requestId, completedAt, errorCode)`
  repository method.
- Produces: classified request-audit error codes and a privacy-safe
  `ai_summary_generation_failed` structured log while retaining the unchanged
  generic provider client response.

- [ ] **Step 1: Add failing service tests for safe audit/log behavior**

Extend `createHarness` in `tests/ai.service.test.ts` so successful provider
fixtures include `providerRequestId: null` and `providerDurationMs: 0`. Add a
helper that constructs `AiSummaryProviderError` with metadata containing
distinct safe values and a separate sensitive raw error string that must never
be logged.

Add parameterized provider-failure tests for every failure class. Each case
must assert:

```ts
await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now)))
  .rejects.toMatchObject({
    statusCode: 503,
    code: 'ai_summary_generation_failed',
    message: 'AI summaries are not available right now.',
    details: {},
  });

expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
  workspaceId,
  'request_1',
  now,
  'quota_exhausted',
);
expect(logger.warn).toHaveBeenCalledWith(
  expect.objectContaining({
    event: 'ai_summary_generation_failed',
    errorCode: 'quota_exhausted',
    providerFailureClass: 'quota_exhausted',
    providerStatus: 429,
    providerCode: 'insufficient_quota',
    providerRequestId: 'req_safe_quota',
    providerDurationMs: 321,
    providerInputTokens: 12,
    providerOutputTokens: 8,
    providerTotalTokens: 20,
  }),
  'AI summary generation failed',
);
```

For every case, stringify both logger calls and the thrown error and assert
they omit a unique prompt fragment, API key, authorization header, raw
provider-body fragment, and raw provider-error message. Add a malformed
meeting-summary fixture that reaches `meetingSummarySchema.parse`; assert it
records/logs `invalid_structured_output` but still returns the generic API
error. Extend the existing successful-generation log assertion to include the
provider request ID, provider duration, and nullable-safe usage fields.

- [ ] **Step 2: Run the service test to confirm behavior is still generic**

Run: `npm test -- tests/ai.service.test.ts`

Expected: FAIL because provider classifications are currently collapsed into
`ai_summary_generation_failed` and provider diagnostic fields are absent.

- [ ] **Step 3: Implement service classification and safe structured logging**

Change the `openai.client.ts` import in `src/modules/ai/ai.service.ts` from a
type-only import to import `isAiSummaryProviderError` and
`AiSummaryProviderFailureMetadata` alongside `AiSummaryProvider`.

Add a local helper that returns `AiSummaryProviderFailureMetadata | null` for
a typed provider error. Add a second local helper used only in the existing
outer `catch` that maps a post-provider `ZodError` from
`meetingSummarySchema.parse` to `invalid_structured_output`; do not classify
the prompt-payload validation errors that occur before the provider request.

Replace the current two-value error-code selection with this precedence:

```ts
const providerFailure = isAiSummaryProviderError(error) ? error.metadata : null;
const errorCode = providerFailure?.failureClass
  ?? (isGeneratedSummaryValidationError(error) ? 'invalid_structured_output' : null)
  ?? (isApiError(error) ? error.code : 'ai_summary_generation_failed');
```

Keep `failSummaryRequestAndReleaseRecap` and its finalization guard unchanged,
but pass that safe `errorCode` to it. Add only safe scalar metadata to the
existing failure warning:

```ts
providerFailureClass: providerFailure?.failureClass ?? null,
providerStatus: providerFailure?.status ?? null,
providerCode: providerFailure?.providerCode ?? null,
providerRequestId: providerFailure?.providerRequestId ?? null,
providerDurationMs: providerFailure?.durationMs ?? null,
providerInputTokens: providerFailure?.usage?.inputTokens ?? null,
providerOutputTokens: providerFailure?.usage?.outputTokens ?? null,
providerTotalTokens: providerFailure?.usage?.totalTokens ?? null,
```

Also add the successful provider result's request ID and duration to the
existing completion event. Do not include provider metadata in an `ApiError`,
route response, or repository public DTO. After the normal `ApiError` branch,
continue throwing precisely the existing generic `ApiError` for every typed
provider and generated-output failure.

- [ ] **Step 4: Run focused service tests**

Run: `npm test -- tests/ai.service.test.ts`

Expected: PASS, including cleanup preservation, revision-conflict behavior,
generic provider responses, classified audit fields, and negative sensitive-log
assertions.

## Task 3: Verify the complete backend contract without external provider work

**Files:**
- Verify: `tests/openai.client.test.ts`
- Verify: `tests/ai.service.test.ts`
- Verify: `tests/ai.routes.test.ts`
- Verify: `src/modules/ai/openai.client.ts`
- Verify: `src/modules/ai/ai.service.ts`

**Interfaces:**
- Consumes: completed adapter/service implementation and the existing backend
test/build scripts.
- Produces: local verification evidence only; it does not change provider,
deployment, database, or Git state.

- [ ] **Step 1: Run the focused AI regression set**

Run:

```powershell
npm test -- tests/openai.client.test.ts tests/ai.service.test.ts tests/ai.routes.test.ts
```

Expected: PASS. The route suite confirms that an absent configured provider
still returns `ai_provider_not_configured` rather than being misclassified as a
runtime provider failure.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Expected: PASS with no missing expanded-provider-result fields, no unsafe
`any`, and no type error around SDK safe metadata fields.

- [ ] **Step 3: Run full backend verification**

Run:

```powershell
npm test
npm run build
npm run openapi:check
```

Expected: PASS. OpenAPI output remains unchanged because the public API error
contract has not changed.

- [ ] **Step 4: Perform a source-level privacy review**

Inspect the final changed lines and search the two AI test files for all
distinctive sensitive fixture tokens. Confirm those tokens occur only in test
input fixtures and negative assertions, never in log payload construction,
request-audit error codes, or API errors. Confirm the only error values passed
to `markSummaryRequestFailed` are stable underscore-separated safe codes.

- [ ] **Step 5: Record unrun release checks without executing them**

Do not call OpenAI, change funding/configuration, deploy, or mutate staging.
Report that AI-01's funded synthetic staging generation and external
operator-alert routing remain user-authorized release checks; cite the
structured `providerFailureClass` event as their intended integration point.

## Plan self-review

Spec coverage is complete: adapter classification, Responses status/error/
incomplete/refusal inspection, safe request IDs/usage/duration, generic client
response preservation, audit/cleanup interaction, privacy-negative tests, and
timeout budget verification each have an owning task. No placeholder language
or undefined interfaces remain. The expanded provider result contract is
propagated to mock and unavailable providers so TypeScript verification is
included rather than assumed.
