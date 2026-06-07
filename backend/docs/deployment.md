# Deployment Readiness

This backend runs as a single Node.js/Fastify service behind a TLS-terminating platform or load balancer.

## Preflight

- Build the image from the repository root with `docker build -t weekly-us-api .`.
- Run `npm run typecheck`, `npm test`, and `npm run openapi:check` before deployment.
- Set `NODE_ENV=production` and `APP_ENV=production` in production.
- Set `PUBLIC_API_BASE_URL` to the public service origin, for example `https://api.example.com`. OpenAPI paths already include `/v1`.
- Set `CORS_ALLOWED_ORIGINS` to exact trusted web origins only. Native mobile clients do not require CORS.
- Keep secrets in the deployment secret store, not in the image or committed files.

## Database Migrations

Use Supabase migrations from `supabase/migrations`.

Recommended release sequence:

1. Back up the database before applying migrations.
2. Preview migration impact with `npm run db:migrate:dry-run` against the target Supabase project.
3. Apply migrations with `npm run db:migrate`.
4. Deploy the new backend image to staging, canary, or another candidate environment.
5. Verify `/health/ready` returns `200` on the deployed candidate before sending production traffic to it.
6. Promote the candidate to production.
7. Monitor application logs, Supabase errors, slow queries, and webhook failures.

The `db:migrate` scripts require the Supabase CLI to be installed and authenticated in the deployment environment.

## Health Checks

- `/health` and `/health/live` return process liveness only.
- `/health/ready` checks database reachability through Supabase and returns `503` when the app should not receive traffic.
- Health responses intentionally include only status, uptime, and coarse dependency state. They do not expose environment values, keys, URLs, tokens, or database errors.

The Docker image uses `/health/ready` for its container health check.

## Logging

Production logging uses Fastify/Pino JSON logs. Sensitive request headers and common token/password fields are redacted, including authorization headers, cookies, API keys, webhook signatures, access tokens, refresh tokens, passwords, and token-like fields.

Do not log raw request bodies for auth, billing, calendar OAuth, AI, or webhook endpoints.

## CORS

Production startup fails when `NODE_ENV=production` or `APP_ENV=production` and no allowed CORS origins are configured. Use exact origins such as:

```text
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Avoid wildcard CORS in production, especially with authenticated routes.

## Backup Checklist Before Real Users

- Confirm automated Supabase/PostgreSQL backups are enabled.
- Perform and document one manual backup restore test in a non-production environment.
- Record recovery point objective and recovery time objective for the product.
- Store backup access in the same secrets/access management process as production database access.
- Verify account deletion, billing, auth, and workspace ownership migrations have a rollback or forward-fix plan before applying them.

