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

## AI recap model configuration

Known meeting templates use the model configured in
`src/modules/ai/summary-prompts.ts`; `AI_MODEL` is only the fallback for an
unknown template ID. It is not a global override.

| Template | Effective model |
| --- | --- |
| `weekly-family-check-in` | `gpt-5.4-nano` |
| `family-with-kids` | `gpt-5.4-nano` |
| `money-check-in` | `gpt-5.4-nano` |
| `busy-week-planning` | `gpt-5.4-nano` |
| `couple-reset` | `gpt-5-mini` |
| `conflict-cleanup` | `gpt-5-mini` |

Each newly claimed recap request records its effective model and prompt
version in backend audit data. After a synthetic staging request, verify only
the effective model, prompt version, safe provider request ID, status,
duration, and token counts in the request audit data or structured logs. Do
not use real meeting data, log prompts, or expose credentials during this
check.

The recap provider uses `max_output_tokens: 800`. In the Responses API this
budget includes visible output and reasoning tokens. Before changing a model,
prompt, output budget, or model snapshot, run a funded staging evaluation with
synthetic content for every supported template. Record the effective model,
prompt version, latency, input/output/total tokens, response status, and any
incomplete reason. An incomplete response caused by `max_output_tokens` fails
the evaluation and requires a changed configuration plus a new recorded run.

The deployed configuration currently uses model aliases. Do not pin a snapshot
until the funded staging evaluation has been reviewed. Record the final
alias-or-snapshot decision, evaluated configuration, deployed revision, and
accepted limitations in `AI_RELEASE_CHECKLIST.md` before release.

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

## Render

This repository includes `render.yaml` for a Render Blueprint deployment with:

- `weekly-us-api`: Docker web service using `./Dockerfile`.
- `weekly-us-worker`: Docker background worker using the same image and `node dist/worker.js`.
- API health checks pointed at `/health/ready`.
- Secrets left unset with `sync: false`, so values must be entered in Render.

When using Render's manual web-service form instead of the Blueprint, use these API settings:

```text
Language: Docker
Root Directory: leave blank
Docker Build Context Directory: .
Dockerfile Path: ./Dockerfile
Docker Command: leave blank
Health Check Path: /health/ready
Auto-Deploy: On Commit
```

Create the worker as a separate Render Background Worker from the same repo:

```text
Language: Docker
Root Directory: leave blank
Docker Build Context Directory: .
Dockerfile Path: ./Dockerfile
Docker Command: node dist/worker.js
Auto-Deploy: On Commit
```

Do not configure Render's pre-deploy command for `npm run db:migrate` with the production Docker image. The image intentionally installs production dependencies only, while the Supabase CLI is a development dependency. Apply Supabase migrations from a trusted local machine or CI environment before deploying code that depends on them.

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

