# AI provider failure classification design

Date: 2026-09-04.

References: [AI_READINESS_REVIEW.md](../../../AI_READINESS_REVIEW.md), AI-08;
[AI_RELEASE_CHECKLIST.md](../../../AI_RELEASE_CHECKLIST.md), step 2.

## Goal

Make provider failures safely diagnosable without changing the mobile API's
established generic provider-failure contract. Operators must be able to tell
quota exhaustion, configuration, transient availability, refusal, incomplete
generation, and invalid structured output apart without inspecting meeting
content or secrets.

## Scope

This work addresses AI-08 only. It builds on the existing request claim,
allowance reservation, atomic finalization, and cleanup paths. It does not
change prompts, models, output DTOs, recap allowance, rate limits, request
authorization, database schema, alerting-provider configuration, or the
mobile app.

All provider-originated failures continue to return the existing safe response:
HTTP `503`, code `ai_summary_generation_failed`, and message `AI summaries are
not available right now.` The existing application errors for local validation,
allowance, rate limits, synchronization, and meeting state are unchanged.

## Chosen approach

Classify provider failures at the OpenAI adapter boundary. `OpenAiSummaryProvider`
will throw a typed internal error containing only safe diagnostic metadata.
`AiSummaryService` will record that metadata in its existing structured failure
event, store the safe classification as the request-audit failure code, perform
the existing failure cleanup, and preserve the generic API response.

This keeps provider-SDK details out of business logic and prevents raw SDK
errors, response bodies, prompts, credentials, and meeting content from
crossing the adapter boundary.

## Components and data flow

### Provider adapter

`src/modules/ai/openai.client.ts` defines a narrow internal provider error type
with these fields:

- `classification`: one of `quota_exhausted`, `authentication_or_configuration`,
  `rate_limited`, `timeout_or_network`, `refused`, `incomplete_output`, or
  `invalid_structured_output`, or `provider_unavailable`;
- nullable safe `status`, `providerCode`, `providerRequestId`, and token usage;
- the effective `model` and the adapter-call `durationMs`.

The type deliberately excludes raw exception messages, headers, request or
response bodies, prompts, API keys, and meeting data. Its constructor must
accept only the listed safe values.

The adapter wraps only the Responses SDK invocation and interprets its error
shape conservatively. Known status/error-code combinations map to quota,
authentication/configuration, rate limiting, or timeout/network. An unknown
transport/SDK failure is classified as `timeout_or_network` only when its
documented type establishes that condition; otherwise an unclassified provider
HTTP failure uses `provider_unavailable`. Authentication/configuration is used
only for confirmed configuration failures. No raw error text is propagated.

Before parsing `output_text`, the adapter inspects the successful Responses
object's status, structured error information, incomplete details, and output
items. A refusal maps to `refused`; an incomplete response maps to
`incomplete_output`; no usable output text or JSON parsing failure maps to
`invalid_structured_output`. Output validation that depends on the
meeting-summary DTO remains in the service, where its validation failure is
also classified as `invalid_structured_output`; the adapter does not duplicate
domain schema rules.

The normal result still returns parsed JSON output plus nullable usage. When
available, usage is normalized from the Responses object without logging or
returning any generated content.

### Service and request audit

`src/modules/ai/ai.service.ts` identifies the typed internal provider error in
its existing catch path. It uses the classification as the safe request-audit
failure code, invokes the existing request/credit cleanup only when finalization
has not been attempted, and emits a structured `ai_summary_generation_failed`
warning containing:

- existing request, workspace, meeting, template, provider, and effective-model
  correlation fields;
- safe provider classification, status, code, request ID, duration, and
  available token counts; and
- the total end-to-end generation duration already captured by the service.

The log payload must contain no `Error` object, raw error message, prompt,
provider response, credential, authorization header, or meeting-derived field.
The existing generic `ApiError` is returned after logging and cleanup. A typed
provider error is never sent to the client, including through API-error details.

Non-provider output validation still yields the established generic failure
response and safe audit code. The service does not add automatic generation
retries: the OpenAI SDK keeps its configured 15-second timeout and one retry,
whose worst-case duration stays below the mobile client's 45-second abort
budget. Tests document this configuration rather than relying on an implied
timing guarantee.

### Operator diagnostics

The structured failure event is the operator integration point. Existing log
or alert routing can use `providerFailureClass` to distinguish quota,
authentication/configuration, and model availability failures as actionable
configuration incidents, while rate limits and timeout/network failures are
transient availability events. This change introduces no new alerting service
or outbound notification and does not assume deployment credentials or an
operator account are available.

## Failure behavior

| Condition | Safe internal classification | Client result |
| --- | --- | --- |
| Provider quota exhausted | `quota_exhausted` | Existing generic 503 error |
| Authentication, model, or configuration error | `authentication_or_configuration` | Existing generic 503 error |
| Provider rate limit | `rate_limited` | Existing generic 503 error |
| SDK timeout or network outage | `timeout_or_network` | Existing generic 503 error |
| Provider refusal | `refused` | Existing generic 503 error |
| Provider incomplete response | `incomplete_output` | Existing generic 503 error |
| Missing, malformed, or schema-invalid provider output | `invalid_structured_output` | Existing generic 503 error |
| Other provider HTTP failure | `provider_unavailable` | Existing generic 503 error |

No provider classification changes authorization, credit accounting, or the
existing safe error response. Failure cleanup preserves the classified request
audit record and releases a reservation where the current failure path can
safely establish that finalization did not happen. The atomic-finalization
uncertainty rules from AI-07 remain unchanged.

## Verification

Tests are written before implementation and cover:

- successful Responses output with safe request ID, duration, and usage
  propagation;
- quota, authentication/model/configuration, rate-limit, timeout/network, and
  unknown SDK-error fixtures, asserting only safe classification crosses the
  adapter boundary;
- Responses fixtures for refusal, incomplete status/details, missing output,
  malformed JSON, and output that fails the meeting-summary schema;
- service audit records and structured logs containing safe classification,
  request ID, status/code, model, duration, and available usage;
- the unchanged generic 503/code/message response for every provider-originated
  case;
- explicit negative assertions that distinctive sensitive prompt text, API-key
  values, authorization-header values, raw provider bodies, and raw SDK error
  messages do not appear in logs, audit arguments, or error responses; and
- OpenAI SDK timeout/retry configuration, with the documented 15-second timeout,
  one retry, and compatibility with the 45-second mobile abort budget.

Run focused client and service tests, then the backend typecheck, complete
backend test suite, build, and OpenAPI validation. No migration or provider
request is required for this work. A funded, synthetic staging generation and
operator-alert routing remain release checks under AI-01 and must not use real
meeting data.

## Manual release checks

In staging, after provider funding/configuration is authorized, exercise a
synthetic recap for each relevant provider failure class. Confirm the mobile
client sees only the generic safe failure, while the operator-visible event
contains a correlation ID, class, status/code where available, model, duration,
and token metadata without request content or credentials. Confirm the
existing reservation/request recovery behavior remains correct after each
failure.

## Implementation result

Implemented 2026-09-04.

- OpenAiSummaryProvider now detects quota exhaustion, authentication/model
  configuration failures, rate limiting, timeout/network faults, generic
  provider outages, Responses refusals, incomplete responses, and malformed or
  absent structured output.
- The adapter exposes only safe classification metadata: provider request ID,
  status/code where available, effective model, duration, and normalized token
  counts. It does not preserve raw SDK error messages, headers, request or
  response bodies, prompts, or credentials.
- AiSummaryService records the safe classification in the request audit and
  structured failure event, and includes safe provider request ID/duration in
  successful completion events. Every provider-originated client response
  remains the existing generic 503 ai_summary_generation_failed result.
- The mock and unavailable providers implement the expanded internal result
  contract without creating fictitious provider diagnostics.

Verification passed: focused AI provider/service/route tests (3 files, 72
tests), full backend suite (56 files, 427 passed and 4 intentionally skipped
tests), npm run typecheck, npm run build, and npm run openapi:check.
No provider request, migration, deployment, staging mutation, configuration
change, or alerting integration was performed. Funded synthetic staging and
external operator-alert routing remain AI-01 release checks.

## Spec self-review

No placeholders remain. Scope is restricted to AI-08; public error behavior,
safe metadata boundaries, classification behavior, retry budget, cleanup
interaction, verification, and release dependencies are explicit and
consistent.
