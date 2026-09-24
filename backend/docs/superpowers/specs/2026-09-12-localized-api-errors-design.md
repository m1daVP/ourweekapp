# Localized API errors

## Goal

Return user-facing API error messages in the mobile app's selected language:
English (`en`), Ukrainian (`uk`), or Spanish (`es`).

## Scope

The frontend will include its active locale in the standard `Accept-Language`
header on every API request. The backend will use that header only to select
the human-readable `message` in existing error responses. The stable response
contract remains:

```json
{
  "message": "…",
  "code": "stable_machine_code",
  "details": {}
}
```

`code`, HTTP status, and `details` do not change with locale. They remain the
source of truth for client branching and diagnostics.

## Locale contract

- Supported locales are exactly `en`, `uk`, and `es`, matching the frontend.
- The backend accepts standard `Accept-Language` values with region subtags,
  such as `uk-UA` and `es-ES`, by matching their primary language subtag.
- It uses the first supported language in header preference order.
- Missing, malformed, or unsupported headers safely fall back to English.
- The frontend sends its selected locale directly (`en`, `uk`, or `es`), so
  normal requests are unambiguous.

## Architecture

A narrow `src/shared/localization` module will own the supported locale type,
header parsing, English fallback, and the translation catalogue keyed by stable
API error code. It will be independent of Fastify and business modules.

The centralized error handler will resolve the locale once per failed request
and replace only the response `message` for:

- expected `ApiError` instances, using their stable `code`;
- Fastify request-validation failures (`validation_failed`);
- rate-limit failures (`rate_limit_exceeded`); and
- unexpected failures (`internal_server_error`).

The original `ApiError.message` remains available to server logs and error
reporting. This preserves diagnostic context and prevents localization from
changing application behavior.

When a code has not yet been catalogued, the error handler returns the
existing English message. This is intentional backward-compatible fallback;
the implementation will catalogue every currently emitted public API error
code before enabling the behavior, so application users do not encounter it.

## Frontend behavior

`src/shared/api/httpClient.ts` will add `Accept-Language` from Vue I18n's
current locale to its default request headers. Explicit caller headers retain
precedence, which keeps the generic API client usable by tests and any future
non-app caller.

## Error handling and privacy

The translation catalogue contains only safe, user-facing copy. Internal error
details are still stripped from 5xx `ApiError` responses. Provider, database,
token, password, request-header, and stack information are never included in
translated messages.

## Testing

- Unit-test locale resolution for supported values, region variants, weighted
  preference ordering, and English fallback.
- Test localized expected API errors, validation errors, rate-limit errors,
  and unexpected errors while proving codes and safe details are unchanged.
- Test frontend request defaults send the active `en`, `uk`, and `es` locale.
- Run backend typecheck and the focused error-handler tests; run the frontend
  typecheck and focused HTTP-client test.

## Non-goals

- Adding new supported locales.
- Changing error codes, status codes, validation details, or OpenAPI response
  schemas.
- Translating logs, Sentry events, database errors, or background-job errors.
- Persisting a user's API locale in the database.
