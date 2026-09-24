# Security Rules

## Secrets

- Never commit secrets.
- Never expose service role keys to frontend/mobile clients.
- Never log tokens, passwords, API keys, cookies, or auth headers.
- Validate required secrets at startup.
- Rotate secrets if exposure is suspected.

## Input Security

- Validate all external input.
- Do not trust frontend validation.
- Limit request body size.
- Sanitize or validate fields used in search/filter/sort.
- Avoid unsafe dynamic SQL.
- Do not pass raw request data directly into database queries.

## Output Security

- Do not return stack traces in production.
- Do not return raw database errors.
- Do not expose internal IDs unless they are part of the public API.
- Do not expose private fields accidentally through broad `select *` queries.

## CORS

- Use explicit allowed origins in production.
- Do not use wildcard CORS with credentials.
- Keep development CORS separate from production CORS.

## Rate Limiting

Use rate limits for:

- login
- registration
- password reset
- invite sending
- public forms
- webhook endpoints
- expensive AI/external-service endpoints

## Webhooks

- Verify webhook signatures when provider supports it.
- Do not trust webhook payloads without verification.
- Make webhook handling idempotent.
- Log webhook failures carefully without leaking secrets.

## Dependencies

- Add dependencies only when needed.
- Prefer maintained packages.
- Remove unused packages.
- Keep lockfile committed.
- Update dependencies regularly.
- Be cautious with packages that run install scripts.

## Sensitive Areas

Treat these changes as high risk:

- auth
- permissions
- payments
- invoices
- user deletion
- workspace membership
- RLS policies
- service role key usage
- email/password flows
