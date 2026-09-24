# Supabase Auth-Context Reliability Design

## Context

Protected API requests verify the application's access token and then load the current session, user, workspace, workspace membership, and subscription through Supabase. A production request failed during this second phase with `PGRST303`, which Supabase defines as JWT claim validation or parsing failure. Supabase rejected the backend's server-to-server credential before the workspace query reached PostgreSQL, but the API exposed the failure as an authentication-related 500 response.

The failure is intermittent: the same configured secret key successfully completed repeated read probes afterward. The application must tolerate one short-lived Supabase JWT-validation failure without retrying invalid mobile access tokens or hiding persistent failures.

## Goals

- Retry a read-only auth-context lookup once when, and only when, Supabase returns `PGRST303`.
- Preserve enough sanitized provider context in internal logs to distinguish claim timing, expiry, and parsing failures.
- Keep database and provider diagnostics out of all client-facing 5xx responses.
- Preserve the existing API contract, authorization checks, and behavior for non-retryable errors.
- Cover retry, failure, logging, and response-sanitization behavior with focused automated tests.

## Non-Goals

- Add or change a database migration, function, or RPC.
- Consolidate the existing auth-context database queries in this change.
- Retry writes, refresh-token rotation, invalid application access tokens, or arbitrary Supabase errors.
- Add a general-purpose retry framework or dependency.

## Considered Approaches

### 1. Retry the complete auth-context lookup in middleware

This is the selected approach. The middleware already separates application-token verification from auth-context loading, so it can retry only the latter. It covers every read used by `getAuthenticatedContext` without changing repository query behavior. During a rare retry it may repeat reads that succeeded in the first attempt, but all involved operations are read-only and scoped by authenticated claims.

### 2. Retry each repository read separately

This would repeat only the failing Supabase request. It would require wrapping several query shapes, threading retry behavior through repository methods, and adding more test seams. The additional complexity is not justified for an intermittent provider-layer failure.

### 3. Replace auth-context reads with a database RPC

This would reduce request fan-out and is a reasonable future optimization. It requires a migration, authorization review, rollout compatibility, and database testing, so it is intentionally excluded from this targeted production fix.

## Architecture

`authenticateRequest` will continue to perform these phases in order:

1. Parse the `Authorization` header.
2. Verify the application's access token.
3. Load the authenticated context from `AuthRepository`.
4. Attach the result to `request.auth`.

Only phase 3 gains retry behavior. A small middleware-local helper will inspect an `ApiError` for `details.databaseCode === 'PGRST303'`. On the first matching failure, it will log a warning, wait for a randomly selected delay from 150 through 300 milliseconds, and invoke `getAuthenticatedContext` once more. The second result is final.

The retry delay function and sleeper will be injectable for deterministic unit tests. Production callers use the jittered delay and a standard promise-based timer. The repository interface used by the middleware will be narrowed to the `getAuthenticatedContext` method so tests can supply a small fake.

## Error Handling and Observability

`throwOnSupabaseError` will continue mapping provider errors to stable `ApiError` codes and messages. It will retain `databaseCode` for internal branching. For `PGRST303` only, it will also retain sanitized `databaseMessage` and `databaseHint` values:

- values are converted to a single line;
- control characters are removed;
- length is capped;
- the provider's `details` field is not retained because it may contain query or record data.

The retry warning and terminal authentication-context error log will include the request ID, stable application code, Supabase code, and sanitized Supabase message/hint. They will not include request headers, tokens, user data, or query values.

The global error handler will send `details: {}` for every `ApiError` whose status is 500 or greater. Internal `ApiError.details` remain available to middleware and logs before serialization. Existing 4xx validation and domain-error details remain unchanged.

Application access-token verification stays outside the retry block. Missing, malformed, expired, or invalid application access tokens continue returning 401 immediately and cannot trigger a Supabase retry.

## Testing

Focused middleware tests will verify:

- a first `PGRST303` failure followed by success calls the repository twice, sleeps once, and sets `request.auth`;
- two consecutive `PGRST303` failures call the repository exactly twice and propagate the second error;
- a non-`PGRST303` repository failure is not retried;
- an invalid application access token is not retried;
- retry diagnostics do not contain authorization headers or tokens.

Repository-helper tests will verify that sanitized `PGRST303` message/hint values are retained internally, while other database errors retain only their code.

Error-handler tests will verify that 5xx `ApiError` details are removed from the HTTP response and that 4xx details remain available.

After focused tests pass, run the full required verification:

```bash
npm run typecheck
npm test
```

## Rollout and Risk

The change requires only an application deployment and is compatible with the current database schema. The bounded retry adds at most one auth-context lookup and 300 milliseconds to a request affected by `PGRST303`. Persistent failures still surface after the second attempt, preserving visibility and avoiding retry storms.

The main remaining risk is that a platform clock-skew incident lasts longer than the retry delay. The retry is intentionally bounded; persistent or repeated `PGRST303` events should be escalated to Supabase with the sanitized provider message and timestamps.
