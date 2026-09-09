# Database Proof Operations

Use these commands to establish the database behavior required by readiness point 7. Evidence files are sanitized summaries; never paste or commit API keys, JWTs, passwords, fixture emails, or credential-bearing URLs.

## Local proof

Start Docker Desktop, then run `npm run db:verify:local`.

The command reads local credentials directly from `supabase status`, verifies that the API host is `127.0.0.1` or `localhost`, resets only that local database, applies every migration, runs pgTAP and all database integration suites without skips, and finishes with typecheck, ordinary tests, build, and OpenAPI verification.

## Staging dry-run

Configure `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, and `SUPABASE_STAGING_SERVICE_ROLE_KEY` in the current process. Set `ALLOW_STAGING_DB_TESTS=true`. The URL project reference must match `supabase/.temp/project-ref`, and the matching remote Supabase project name must contain the word `staging`.

Run `npm run db:verify:staging`. This default mode lists linked migrations and performs `supabase db push --dry-run`. It creates no fixtures and applies no migrations. Review the generated `staging-dry-run-YYYY-MM-DD.md`, including every pending migration and its auth, RLS, ownership, data, and locking impact.

## Staging apply and smoke proof

After the exact pending migration list and recovery notes receive explicit approval, set `APPLY_STAGING_MIGRATIONS=true` and rerun `npm run db:verify:staging`.

The command applies only repository migrations, verifies migration parity, runs direct-access, ownership, fixture-cleanup, and successful account-deletion smoke suites, and removes the UUID-tagged fixtures and temporary Auth users.

If migration application fails, stop dependent deployment, redact and preserve diagnostics, and create a reviewed forward-only migration. Never edit an applied migration or reset staging.

If cleanup fails, keep readiness point 7 open. Use the evidence run ID and affected table names to remove only `db-proof-` fixtures; do not update or delete unrelated staging data.
