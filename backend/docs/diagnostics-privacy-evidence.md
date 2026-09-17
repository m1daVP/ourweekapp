# Diagnostics privacy evidence

Updated: 2026-09-17

## Implemented delivery boundary

- Mobile and API Sentry SDKs are both pinned to `10.71.0` in their respective `package.json` files.
- Sentry initializes only when its DSN is configured. The source does not establish whether a production DSN is currently configured.
- Both SDKs use an allowlist-based `beforeSend` filter. It retains a generic error type and selected stack metadata; API events may additionally retain a validated HTTP method and route pattern.
- Raw exception messages, request URLs and query strings, headers, bodies, user details, extras, breadcrumbs, frame source context, and local variables are excluded by the application filter or SDK collection settings.
- Performance tracing is disabled. This source review found no replay, attachment, feedback, profiling, or log-ingestion setup.

## Separate log flows

- API Pino redaction is configured in `src/shared/logging/pino-options.ts`; it is separate from Sentry filtering and does not prove proxy, hosting, or provider log redaction.
- The deployed retention periods, hosting/provider regions, access roles, Sentry IP-address setting, attachments setting, and Sentry retention are not available from repository source. They must be verified in the relevant provider/admin consoles before a production retention or regional-processing statement is made.
- No production events or user data were inspected. Sanitizer tests use synthetic marker values only.

## Required operational follow-up

1. Record the deployed Sentry project, region, retention, member roles, IP-address handling, data-scrubbing rules, attachment/replay/tracing/log-ingestion settings, and owner of periodic review.
2. Exercise a synthetic test-environment event containing marker values in an error message, URL query, breadcrumb, tag, extra, nested cause, and request metadata. Confirm the received event is diagnostically useful but contains none of the markers.
3. Record Pino, reverse-proxy, hosting, and support-copy retention independently. Do not infer them from Sentry configuration.
4. Obtain legal review for the purpose-specific lawful basis and applicable data-subject controls; SDK configuration does not determine lawful basis.
