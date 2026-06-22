# Deployment Readiness

This backend runs as separate API and background-worker processes built from the same repository and Dockerfile. The Fastify API runs behind a TLS-terminating platform or load balancer; the worker does not accept HTTP traffic.

## Preflight

- Build the API image from the repository root with `docker build --target runtime -t weekly-us-api .`.
- Build the worker image with `docker build --target worker -t weekly-us-worker .`.
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
4. Deploy the new API and worker images to staging, canary, or another candidate environment.
5. Verify `/health/ready` returns `200` on the deployed candidate before sending production traffic to it.
6. Promote the candidate to production.
7. Monitor application logs, Supabase errors, slow queries, and webhook failures.

The `db:migrate` scripts require the Supabase CLI to be installed and authenticated in the deployment environment.

Queue migrations must be applied before starting a worker version that depends on them. The queue RPC functions are callable only with the backend service-role key and must not be exposed to mobile clients.

## Background Worker

- Run locally with `npm run dev:worker` and in a built deployment with `npm run start:worker`.
- Run the worker as a separate process or container from the API. Scale queue throughput by increasing worker replicas rather than adding in-process concurrency.
- The worker needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL`, and the `QUEUE_*` settings. It does not need API auth, CORS, or HTTP configuration.
- Monitor worker restart count, queue length, oldest-message age, dead-letter queue growth, and repeated queue-operation errors.
- Configure the deployment platform to restart the worker after a nonzero exit. The worker exits after `QUEUE_MAX_CONSECUTIVE_FAILURES` failures of the same queue operation.
- Job handlers receive an abort signal, must honor it, and must remain idempotent. Visibility is renewed while handlers run, but a completed handler can still run again if acknowledgement fails.
- Job envelopes are limited to 16 KiB and should contain opaque identifiers rather than meeting content, provider credentials, or other sensitive data.
- Dead letters retain metadata and a payload fingerprint, never the original payload. The worker purges records older than `QUEUE_DEAD_LETTER_RETENTION_DAYS` on startup and hourly.

## Health Checks

- `/health` and `/health/live` return process liveness only.
- `/health/ready` checks database reachability through Supabase and returns `503` when the app should not receive traffic.
- Health responses intentionally include only status, uptime, and coarse dependency state. They do not expose environment values, keys, URLs, tokens, or database errors.

The Docker image uses `/health/ready` for its container health check.

The worker image has no HTTP health check. Use process liveness and automatic restart policy; queue connectivity failures use bounded polling backoff and eventually terminate the process when the configured failure threshold is reached.

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

