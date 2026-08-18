# Supabase Auth-Context Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover once from intermittent Supabase `PGRST303` failures during read-only auth-context loading while improving internal diagnostics and preventing provider details from reaching mobile clients.

**Architecture:** Keep application access-token verification unchanged and add a single bounded retry around the complete auth-context lookup in `auth.middleware.ts`. Preserve only sanitized `PGRST303` message/hint fields inside `ApiError.details` for logging and retry classification, then strip all 5xx details at the HTTP serialization boundary.

**Tech Stack:** Node.js 24, TypeScript, Fastify 5, Supabase JS 2, Zod, Vitest 4

## Global Constraints

- Do not add dependencies.
- Do not add or modify database migrations, functions, or RPCs.
- Retry only `PGRST303` from the read-only access-token auth-context lookup.
- Retry at most once after 150-300 milliseconds of jitter.
- Do not retry missing, malformed, expired, or invalid application access tokens.
- Do not retry refresh-token rotation, writes, or other Supabase/PostgreSQL errors.
- Do not log or return tokens, authorization headers, request bodies, query values, or provider `details` fields.
- Return `details: {}` for every 5xx `ApiError`; preserve existing 4xx details.
- Do not stage or commit changes without explicit user authorization.

---

## File Map

- Modify `src/shared/repositories/supabase.repository.ts`: sanitize and retain narrowly scoped `PGRST303` diagnostics in internal `ApiError.details`.
- Modify `src/shared/errors/error-handler.ts`: remove all internal details from 5xx HTTP responses.
- Modify `src/modules/auth/auth.middleware.ts`: classify retryable auth-context failures, apply one jittered retry, and log safe structured diagnostics.
- Modify `tests/repository-helpers.test.ts`: cover provider diagnostic sanitization and exclusion.
- Modify `tests/error-handler.sentry.test.ts`: cover 5xx detail removal and 4xx detail preservation.
- Create `tests/auth.middleware.test.ts`: cover retry and non-retry behavior at the middleware boundary.

---

### Task 1: Safe Supabase Diagnostics and 5xx Response Sanitization

**Files:**
- Modify: `tests/repository-helpers.test.ts`
- Modify: `tests/error-handler.sentry.test.ts`
- Modify: `src/shared/repositories/supabase.repository.ts`
- Modify: `src/shared/errors/error-handler.ts`

**Interfaces:**
- Consumes: Supabase `PostgrestError` fields `code`, `message`, and `hint`.
- Produces: `ApiError.details.databaseCode` for internal branching; optional sanitized `databaseMessage` and `databaseHint` only for `PGRST303`; client-facing `{}` for every 5xx `ApiError`.

- [ ] **Step 1: Add failing repository-helper tests for safe `PGRST303` diagnostics**

Extend `tests/repository-helpers.test.ts` with a test that makes `findActiveUser` receive:

```ts
{
  code: 'PGRST303',
  message: ' JWT\nissued\tat future ',
  details: 'must never be retained',
  hint: ' Retry\r\nafter clocks synchronize. ',
}
```

Assert that the rejected `ApiError` contains exactly:

```ts
{
  statusCode: 500,
  code: 'auth_user_lookup_failed',
  details: {
    databaseCode: 'PGRST303',
    databaseMessage: 'JWT issued at future',
    databaseHint: 'Retry after clocks synchronize.',
  },
}
```

Also update the existing `PGRST999` test to assert that its details equal only `{ databaseCode: 'PGRST999' }`, proving arbitrary provider messages are not retained.

- [ ] **Step 2: Add failing error-handler tests for response detail boundaries**

In `buildAppWithErrorHandler`, register these routes:

```ts
app.get('/expected-server', async () => {
  throw new ApiError(500, 'database_failed', 'Unable to load data.', {
    databaseCode: 'PGRST303',
    databaseMessage: 'JWT issued at future',
  });
});

app.get('/expected-client', async () => {
  throw new ApiError(409, 'update_conflict', 'The record changed.', {
    serverRevision: 2,
  });
});
```

Add assertions that `/expected-server` returns `details: {}` and `/expected-client` returns `details: { serverRevision: 2 }`. Confirm neither expected `ApiError` is passed to the explicit `captureException` call.

- [ ] **Step 3: Run focused tests and verify the new assertions fail**

Run:

```bash
npx vitest run tests/repository-helpers.test.ts tests/error-handler.sentry.test.ts
```

Expected: failures because `PGRST303` diagnostics are not retained and 5xx details are still serialized.

- [ ] **Step 4: Implement narrow diagnostic sanitization**

In `src/shared/repositories/supabase.repository.ts`, add a 256-character sanitizer:

```ts
const MAX_PROVIDER_DIAGNOSTIC_LENGTH = 256;

function sanitizeProviderDiagnostic(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROVIDER_DIAGNOSTIC_LENGTH);

  return sanitized || undefined;
}
```

Build the internal details without retaining `PostgrestError.details`:

```ts
const details: Record<string, unknown> = {
  databaseCode: error.code,
};

if (error.code === 'PGRST303') {
  const databaseMessage = sanitizeProviderDiagnostic(error.message);
  const databaseHint = sanitizeProviderDiagnostic(error.hint);

  if (databaseMessage) details.databaseMessage = databaseMessage;
  if (databaseHint) details.databaseHint = databaseHint;
}

throw new ApiError(500, code, message, details);
```

- [ ] **Step 5: Strip 5xx details at the HTTP boundary**

In `src/shared/errors/error-handler.ts`, change only the `ApiError` response serialization:

```ts
details: error.statusCode >= 500 ? {} : error.details,
```

Keep the internal error object intact for middleware decisions and structured logging.

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npx vitest run tests/repository-helpers.test.ts tests/error-handler.sentry.test.ts
```

Expected: both files pass.

---

### Task 2: Bounded `PGRST303` Auth-Context Retry

**Files:**
- Create: `tests/auth.middleware.test.ts`
- Modify: `src/modules/auth/auth.middleware.ts`

**Interfaces:**
- Consumes: `AuthRepository.getAuthenticatedContext(claims): Promise<AuthContext | null>` and internal `ApiError.details.databaseCode` diagnostics.
- Produces: unchanged `authenticateRequest(request, reply, repository?, retryOptions?)` behavior plus optional deterministic retry dependencies for tests.

- [ ] **Step 1: Create the middleware test harness**

In `tests/auth.middleware.test.ts`, assign the standard test environment before dynamically importing auth modules. Use `issueAccessToken` to create a valid application token with `user-1`, `session-1`, `workspace-1`, and role `owner`.

Create a structural repository fake:

```ts
const repository = {
  getAuthenticatedContext: vi.fn(),
};
```

Create a request stub with `headers.authorization`, `id: 'req-test'`, `auth`, and `log.warn`/`log.error` spies. Pass a retry-options object with `sleep: vi.fn().mockResolvedValue(undefined)` and `getDelayMs: () => 200` so tests do not wait.

- [ ] **Step 2: Add a failing recovery test**

Make the repository reject once with:

```ts
new ApiError(500, 'auth_workspace_lookup_failed', 'Unable to load auth workspace.', {
  databaseCode: 'PGRST303',
  databaseMessage: 'JWT issued at future',
})
```

Then resolve with a complete `AuthContext`. Assert:

- the repository is called twice with the verified claims;
- `sleep` is called once with `200`;
- `request.auth` receives the resolved context;
- `request.log.warn` records `databaseCode: 'PGRST303'` and `databaseMessage: 'JWT issued at future'`;
- no authorization header or token appears in the serialized warning arguments.

- [ ] **Step 3: Add failing terminal and non-retry tests**

Add cases proving:

1. Two consecutive `PGRST303` errors call the repository exactly twice, sleep once, log one retry warning plus one terminal error, and reject with the second error.
2. `PGRST999` calls the repository once, never sleeps, and rejects immediately.
3. An invalid application access token calls the repository zero times and returns the existing `unauthenticated` error without sleeping.

- [ ] **Step 4: Run the middleware tests and verify they fail**

Run:

```bash
npx vitest run tests/auth.middleware.test.ts
```

Expected: failures because retry options and retry behavior do not exist.

- [ ] **Step 5: Implement the retry classifier and safe diagnostic extractor**

In `src/modules/auth/auth.middleware.ts`, define structural types and helpers:

```ts
type AuthContextLoader = Pick<AuthRepository, 'getAuthenticatedContext'>;

type AuthContextRetryOptions = {
  sleep?: (delayMs: number) => Promise<void>;
  getDelayMs?: () => number;
};

function databaseDiagnostics(error: unknown) {
  if (!isApiError(error)) return {};

  const { databaseCode, databaseMessage, databaseHint } = error.details;
  return { databaseCode, databaseMessage, databaseHint };
}

function isRetryableAuthContextError(error: unknown) {
  return databaseDiagnostics(error).databaseCode === 'PGRST303';
}
```

Use runtime type guards before placing diagnostic values into structured logs so only strings are logged.

- [ ] **Step 6: Implement one jittered retry around context loading**

Add defaults:

```ts
const AUTH_CONTEXT_RETRY_MIN_DELAY_MS = 150;
const AUTH_CONTEXT_RETRY_MAX_DELAY_MS = 300;

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

function authContextRetryDelayMs() {
  const range = AUTH_CONTEXT_RETRY_MAX_DELAY_MS - AUTH_CONTEXT_RETRY_MIN_DELAY_MS + 1;
  return AUTH_CONTEXT_RETRY_MIN_DELAY_MS + Math.floor(Math.random() * range);
}
```

Change the repository parameter to `AuthContextLoader` and add optional retry dependencies. Wrap only `repository.getAuthenticatedContext(claims)`:

```ts
async function loadAuthenticatedContextWithRetry(...) {
  try {
    return await repository.getAuthenticatedContext(claims);
  } catch (error) {
    if (!isRetryableAuthContextError(error)) throw error;

    request.log.warn(
      { ...databaseDiagnostics(error), code: 'auth_context_retry', requestId: request.id },
      'Retrying authentication context lookup',
    );
    await retrySleep(getDelayMs());
    return repository.getAuthenticatedContext(claims);
  }
}
```

Keep access-token verification before this helper. Keep the existing terminal catch, but add the guarded `databaseCode`, `databaseMessage`, and `databaseHint` fields to its structured error log.

- [ ] **Step 7: Run middleware tests and verify they pass**

Run:

```bash
npx vitest run tests/auth.middleware.test.ts
```

Expected: all retry and non-retry cases pass without real timers.

- [ ] **Step 8: Run all focused regression tests together**

Run:

```bash
npx vitest run tests/auth.middleware.test.ts tests/repository-helpers.test.ts tests/error-handler.sentry.test.ts
```

Expected: all focused tests pass.

---

### Task 3: Full Verification and Review

**Files:**
- Verify: `src/modules/auth/auth.middleware.ts`
- Verify: `src/shared/repositories/supabase.repository.ts`
- Verify: `src/shared/errors/error-handler.ts`
- Verify: `tests/auth.middleware.test.ts`
- Verify: `tests/repository-helpers.test.ts`
- Verify: `tests/error-handler.sentry.test.ts`

**Interfaces:**
- Consumes: completed implementation from Tasks 1 and 2.
- Produces: a type-safe, tested backend build ready for review and deployment.

- [ ] **Step 1: Run TypeScript validation**

Run:

```bash
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: every Vitest suite passes.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and fresh compiled output under ignored `dist/`.

- [ ] **Step 4: Review the final diff for privacy and scope**

Run:

```bash
git diff --check
git diff -- src/modules/auth/auth.middleware.ts src/shared/repositories/supabase.repository.ts src/shared/errors/error-handler.ts tests/auth.middleware.test.ts tests/repository-helpers.test.ts tests/error-handler.sentry.test.ts docs/superpowers
```

Confirm:

- no token, header, user, request-body, query-value, or provider `details` logging was added;
- only `PGRST303` is retried;
- retry count is exactly one;
- all 5xx client details are empty;
- 4xx client details remain unchanged;
- no database or dependency files changed;
- unrelated untracked files remain untouched.

- [ ] **Step 5: Report completion without staging or committing**

Summarize changed files, focused/full checks, retry behavior, remaining Supabase platform risk, and manual production validation. Do not stage or commit unless the user separately supplies explicit authorization.
