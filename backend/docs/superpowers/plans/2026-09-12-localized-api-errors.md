# Localized API Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return API error messages in the active frontend language while preserving existing status codes, error codes, and safe details.

**Architecture:** The frontend includes its active Vue I18n locale in the standard `Accept-Language` request header. A backend-only shared localization module parses that header and selects translated copy by stable API error code; the centralized Fastify error handler is the sole HTTP integration point, leaving all services and route contracts untouched.

**Tech Stack:** TypeScript 7, Fastify 5, Vue I18n 11, Vitest 4.

## Global Constraints

- Support exactly `en`, `uk`, and `es`; match region-tagged values by primary subtag and fall back to `en`.
- Preserve every HTTP status, `code`, `details`, response schema, Sentry context, log message, and 5xx-detail redaction behavior.
- Translate user-facing HTTP error messages only; do not translate logs, Sentry events, jobs, database errors, or provider errors.
- Add no dependency, migration, request-body field, or persistent locale storage.
- Caller-provided request headers override the frontend client default.
- Do not stage or commit without the user's explicit approved numbered commit list.

---

## File Structure

- Create `src/shared/localization/api-error-localization.ts`: owns locale normalization, the complete API error-code catalogue, translated messages, and fallback behavior without Fastify dependencies.
- Modify `src/shared/errors/api-error.ts`: constrain expected API errors to the localization catalogue's stable code union.
- Create `tests/api-error-localization.test.ts`: validates header parsing and localized message lookup in isolation.
- Modify `src/shared/errors/error-handler.ts`: resolve the request locale and use the shared lookup for every serialized error branch.
- Modify `tests/error-handler.sentry.test.ts`: prove HTTP messages localize while observability, codes, and redaction remain unchanged.
- Modify `D:/Projects/myself/weekly-us/src/shared/api/httpClient.ts`: add the active Vue I18n locale to default headers.
- Modify `D:/Projects/myself/weekly-us/src/shared/api/__tests__/httpClient.test.ts`: mock active locales and prove outbound header behavior plus caller override behavior.

### Task 1: Make locale resolution and error copy a narrow, complete backend boundary

**Files:**
- Create: `src/shared/localization/api-error-localization.ts`
- Test: `tests/api-error-localization.test.ts`

**Interfaces:**
- Consumes: an optional Fastify `accept-language` header value and a stable API error code.
- Produces:
  - `type SupportedApiLocale = 'en' | 'uk' | 'es'`
  - `type ApiErrorCode = keyof typeof API_ERROR_MESSAGES`
  - `resolveApiLocale(acceptLanguage?: string): SupportedApiLocale`
  - `getLocalizedApiErrorMessage(locale: SupportedApiLocale, code: string, fallbackMessage: string): string`

- [ ] **Step 1: Write the failing locale and message-lookup tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  getLocalizedApiErrorMessage,
  resolveApiLocale,
} from '../src/shared/localization/api-error-localization.js';

describe('API error localization', () => {
  it.each([
    ['uk', 'uk'],
    ['uk-UA, en;q=0.8', 'uk'],
    ['fr-CA, es-ES;q=0.9, en;q=0.8', 'es'],
    ['de-DE, fr;q=0.9', 'en'],
    [undefined, 'en'],
  ] as const)('resolves %s to %s', (header, expected) => {
    expect(resolveApiLocale(header)).toBe(expected);
  });

  it('returns a Ukrainian API message without changing its machine code', () => {
    expect(
      getLocalizedApiErrorMessage(
        'uk',
        'meeting_not_found',
        'Meeting not found.',
      ),
    ).toBe('Зустріч не знайдено.');
  });

  it('returns the original English fallback for an unknown code', () => {
    expect(
      getLocalizedApiErrorMessage('es', 'future_error_code', 'Safe fallback.'),
    ).toBe('Safe fallback.');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/api-error-localization.test.ts`

Expected: FAIL because `api-error-localization.ts` does not exist.

- [ ] **Step 3: Implement a header parser and an exhaustively typed copy catalogue**

Create `api-error-localization.ts` with a local `SUPPORTED_API_LOCALES` tuple and a parser that splits the header on commas, removes each optional `;q=…` parameter, lowercases the language range, then compares the primary subtag in client preference order. Do not parse numeric q-values: preserving declared order is deterministic and sufficient for the app, which sends one exact locale.

Define the English, Ukrainian, and Spanish copy in a single catalogue keyed by the emitted HTTP error codes. Include these static code keys, and preserve the current English message as the `en` value for each:

```ts
const PUBLIC_API_ERROR_CODES = [
  'account_create_failed', 'account_deleted', 'account_link_conflict',
  'account_link_email_mismatch', 'account_link_required', 'account_not_found',
  'ai_provider_not_configured', 'ai_summary_generation_failed',
  'ai_summary_generation_in_progress', 'ai_summary_input_too_large',
  'ai_summary_insufficient_content', 'ai_summary_invalid_source',
  'ai_summary_rate_limited', 'ai_summary_request_cache_invalid',
  'ai_summary_request_claim_invalid', 'ai_summary_request_finalization_invalid',
  'auth_context_lookup_failed', 'auth_identity_link_failed',
  'auth_identity_lookup_failed', 'auth_lookup_failed',
  'background_job_dead_letter_purge_failed', 'background_job_enqueue_failed',
  'background_job_queue_response_invalid', 'calendar_cleanup_connection_unavailable',
  'calendar_token_decrypt_failed', 'duplicate_participant_id',
  'email_already_registered', 'feature_not_available',
  'feature_role_restricted', 'follow_up_not_found', 'forbidden',
  'google_already_linked', 'google_sign_in_not_configured',
  'history_not_available', 'household_member_limit_reached',
  'internal_server_error', 'invalid_calendar_redirect_url', 'invalid_credentials',
  'invalid_google_token', 'invalid_oauth_state', 'invalid_reset_code',
  'invalid_session', 'invitation_accept_failed', 'invitation_delivery_failed',
  'invitation_email_mismatch', 'invitation_invalid_or_expired',
  'invitation_lookup_failed', 'meeting_invalid_reference', 'meeting_not_completed',
  'meeting_not_found', 'meeting_summary_mismatch', 'meeting_summary_server_owned',
  'meeting_update_conflict', 'participant_avatar_forbidden',
  'participant_create_failed', 'participant_limit_exceeded', 'participant_not_found',
  'not_found', 'database_failed', 'update_conflict', 'password_reset_failed',
  'premium_required', 'rate_limit_exceeded',
  'recap_allowance_exhausted', 'session_create_failed', 'session_refresh_failed',
  'session_revoke_failed', 'subscription_owner_required',
  'subscription_provider_unavailable', 'task_not_found',
  'task_review_decision_invalid_reference', 'unauthenticated', 'validation_failed',
  'webhook_not_configured', 'webhook_unauthorized', 'workspace_create_failed',
  'workspace_invitation_create_failed', 'workspace_invitation_not_found',
  'workspace_last_owner', 'workspace_member_already_linked',
  'workspace_member_create_failed', 'workspace_member_not_found',
  'workspace_member_role_invalid', 'workspace_member_status_transition_invalid',
  'workspace_not_found',
] as const;

type PublicApiErrorCode = (typeof PUBLIC_API_ERROR_CODES)[number];
type LocalizedMessages = Record<SupportedApiLocale, string>;
const API_ERROR_MESSAGES: Record<PublicApiErrorCode, LocalizedMessages> = {
  meeting_not_found: {
    en: 'Meeting not found.', uk: 'Зустріч не знайдено.', es: 'No se encontró la reunión.',
  },
};
```

Write one reviewed, user-facing `en`, `uk`, and `es` object member for every
tuple member shown above. The `Record` type must make an omitted translation a
compile error. `getLocalizedApiErrorMessage` returns the entry for a known code
and otherwise returns `fallbackMessage`, which retains backward compatibility
for an unexpected future code.

Export `ApiErrorCode` from this module and change the `ApiError` constructor's
`code` parameter and public property in `src/shared/errors/api-error.ts` from
`string` to `ApiErrorCode`. Update helper parameters that construct an
`ApiError` (for example, `throwOnSupabaseError` and queue mutation helpers) to
accept `ApiErrorCode`. `npm run typecheck` will then identify every emitted
code absent from the catalogue; add each reported code to
`PUBLIC_API_ERROR_CODES` and all three language entries before considering the
catalogue complete. Do not type-cast code strings to bypass that coverage.

- [ ] **Step 4: Run focused unit and type checks**

Run: `npm test -- tests/api-error-localization.test.ts; npm run typecheck`

Expected: PASS; region aliases and fallback resolve deterministically, the sample Ukrainian copy is returned, unknown codes preserve their original English copy, and the catalogue is complete at compile time.

### Task 2: Apply localized copy only at the centralized HTTP serialization boundary

**Files:**
- Modify: `src/shared/errors/error-handler.ts:19-94`
- Modify: `tests/error-handler.sentry.test.ts:14-117`

**Interfaces:**
- Consumes: `resolveApiLocale(request.headers['accept-language'])` and `getLocalizedApiErrorMessage(locale, code, fallbackMessage)` from Task 1.
- Produces: the existing `{ message, code, details }` response where only `message` is locale-specific.

- [ ] **Step 1: Extend error-handler fixture routes and write failing localization assertions**

Add a request header to the existing expected-error test and assert exact response equality:

```ts
const response = await app.inject({
  method: 'GET',
  url: '/expected',
  headers: { 'accept-language': 'es-ES, en;q=0.8' },
});

expect(response.statusCode).toBe(404);
expect(response.json()).toEqual({
  message: 'No se encontró el recurso.',
  code: 'not_found',
  details: {},
});
expect(captureException).not.toHaveBeenCalled();
```

Add a validation route (for example, a route with a required string query schema) and a request with `accept-language: uk-UA`; assert `code: 'validation_failed'`, the localized Ukrainian top-level message, and the unchanged safe `details.context` and `details.issues` values. Add a rate-limited fixture and assert the Spanish `rate_limit_exceeded` message. Finally, request `/unexpected` with `accept-language: uk`, assert the Ukrainian generic 500 copy and the existing Sentry call shape.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/error-handler.sentry.test.ts`

Expected: FAIL because `error-handler.ts` serializes its hard-coded or original English message without inspecting request headers.

- [ ] **Step 3: Resolve the locale once and localize all four response paths**

At the beginning of the registered error handler callback, derive:

```ts
const locale = resolveApiLocale(request.headers['accept-language']);
```

For the expected `ApiError` branch, use:

```ts
message: getLocalizedApiErrorMessage(locale, error.code, error.message),
```

For validation and rate-limit responses, introduce local English fallback constants only if needed, then call the same lookup using `validation_failed` and `rate_limit_exceeded`. For unexpected errors, use the same lookup with `internalServerError.code` and `internalServerError.message`.

Do not mutate the thrown `ApiError`; logs must continue to receive the original error object. Keep the existing `error.statusCode >= 500 ? {} : error.details` expression exactly intact.

- [ ] **Step 4: Run focused backend verification**

Run: `npm test -- tests/error-handler.sentry.test.ts tests/api-error-localization.test.ts; npm run typecheck`

Expected: PASS; localized output is limited to response messages, expected errors remain absent from Sentry, unexpected errors retain the present safe Sentry context, and 5xx details remain empty.

### Task 3: Forward the active app locale from the shared frontend HTTP client

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/httpClient.ts:1-3,120-126`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/httpClient.test.ts:26-42,80-124`

**Interfaces:**
- Consumes: `i18n.global.locale.value` from `src/features/localization/i18n.ts`.
- Produces: default API request headers with `Accept-Language: en | uk | es`.

- [ ] **Step 1: Make the test loader control the active frontend locale and add failing header tests**

Change the test mock to expose a mutable locale value:

```ts
const activeLocale = vi.hoisted(() => ({ value: 'en' as 'en' | 'uk' | 'es' }));

vi.doMock('@/features/localization/i18n', () => ({
  i18n: { global: { locale: activeLocale } },
  translate: (key: string) => key,
}));
```

Add a parameterized request test:

```ts
it.each(['en', 'uk', 'es'] as const)('sends %s as Accept-Language', async (locale) => {
  activeLocale.value = locale;
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  const { apiRequest } = await loadHttpClient();

  await apiRequest('/auth/me');

  expect(fetchMock).toHaveBeenCalledWith(
    'http://api.test/v1/auth/me',
    expect.objectContaining({
      headers: expect.objectContaining({ 'Accept-Language': locale }),
    }),
  );
});
```

Add a separate test where `options.headers` includes `Accept-Language: 'es'` while the active locale is `uk`; assert the explicit caller header remains `es`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/shared/api/__tests__/httpClient.test.ts`

Working directory: `D:/Projects/myself/weekly-us`

Expected: FAIL because `httpClient.ts` currently initializes headers with only `Accept` and caller headers.

- [ ] **Step 3: Add the header at the existing shared request default**

Import `i18n` alongside `translate`, then set the default before spreading caller headers:

```ts
const headers: Record<string, string> = {
  Accept: 'application/json',
  'Accept-Language': i18n.global.locale.value,
  ...options.headers,
};
```

Do not add a per-feature header, duplicate it in API wrappers, or change retry behavior. The existing retry invokes `sendApiRequest` again, so it will read the current selected locale for the retry automatically.

- [ ] **Step 4: Run focused frontend verification**

Run: `npm test -- src/shared/api/__tests__/httpClient.test.ts; npm run typecheck`

Working directory: `D:/Projects/myself/weekly-us`

Expected: PASS; every active supported locale is sent, explicit client overrides remain possible, and API error decoding remains unchanged.

### Task 4: Run end-to-end contract checks and leave the change reviewable

**Files:**
- Modify only the files from Tasks 1–3.

**Interfaces:**
- Consumes: frontend `Accept-Language` forwarding and backend error-handler localization.
- Produces: a verified cross-repository response contract without schema or migration changes.

- [ ] **Step 1: Add a direct handler contract assertion for code/details stability**

In `tests/error-handler.sentry.test.ts`, compare the English and Spanish responses for the same expected client error:

```ts
expect(spanish.statusCode).toBe(english.statusCode);
expect(spanish.json().code).toBe(english.json().code);
expect(spanish.json().details).toEqual(english.json().details);
expect(spanish.json().message).not.toBe(english.json().message);
```

- [ ] **Step 2: Run the backend suite and API-contract check**

Run: `npm run typecheck; npm test; npm run openapi:check`

Working directory: `D:/Projects/myself/weekly-us-api`

Expected: PASS; error schema and generated OpenAPI output do not change because the response shape is unchanged.

- [ ] **Step 3: Run frontend verification**

Run: `npm run typecheck; npm test -- src/shared/api/__tests__/httpClient.test.ts`

Working directory: `D:/Projects/myself/weekly-us`

Expected: PASS; the client continues to issue compatible requests with its locale preference.

- [ ] **Step 4: Review the final diff without staging**

Run: `git diff -- src/shared/localization/api-error-localization.ts src/shared/errors/error-handler.ts tests/api-error-localization.test.ts tests/error-handler.sentry.test.ts`

Working directory: `D:/Projects/myself/weekly-us-api`

Run: `git diff -- src/shared/api/httpClient.ts src/shared/api/__tests__/httpClient.test.ts`

Working directory: `D:/Projects/myself/weekly-us`

Expected: only the planned localization, error-handler, and HTTP-header changes are present. Do not stage or commit.

## Plan Self-Review

- **Spec coverage:** Task 1 implements the three-locale contract, primary-subtag matching, and fallback. Task 2 covers every serialized backend error class while preserving privacy and observability. Task 3 forwards the actual selected app locale. Task 4 proves the unchanged stable API contract.
- **Placeholder scan:** no pending decisions, unspecified files, or deferred implementation steps remain. The typed catalogue deliberately requires complete translations for the explicitly listed current codes.
- **Type consistency:** Task 1 exports the exact two functions and one locale type consumed in Task 2; Task 3 uses Vue I18n's existing locale union without creating a second frontend locale type.
