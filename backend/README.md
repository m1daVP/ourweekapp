# OurWeek API

Backend for OurWeek mobile app, a guided weekly
check-in app for couples and families. This service owns account sessions,
workspaces, meeting and task sync, Premium entitlement checks, calendar
connections, and AI recap requests. The mobile app lives in the separate
frontend repository.

## Stack and architecture

- Node.js 24, TypeScript, Fastify, Zod, and npm
- PostgreSQL and Supabase for persistence
- Supabase service-role access confined to the server
- RevenueCat for subscription validation and webhooks
- Google OAuth/Calendar, OpenAI, SMTP, and Sentry as configured integrations

`src/server.ts` starts the service. `src/app.ts` registers plugins and
routes. Domain code is under `src/modules/`; database changes are in
`supabase/migrations/`. The public API is under `/v1`, with health endpoints
outside that prefix. API responses use client-facing DTOs rather than raw
database rows.

## Run locally

**Requirements:** Node.js 24, npm, Docker, and the Supabase CLI used by this
project. You can use a separate Supabase development project instead of local
Supabase, but never point local tests at production data.

1. Install dependencies and start the local database:

   ```sh
   npm ci
   npm run supabase:start
   ```

2. Copy the configuration template:

   ```sh
   cp .env.example .env
   npx supabase status
   ```

   Set `SUPABASE_URL` to the local Supabase API URL and
   `SUPABASE_SERVICE_ROLE_KEY` to the local service-role key reported by
   Supabase. Replace the example token and encryption secrets with locally
   generated random values of at least 32 characters. The default
   `PUBLIC_API_BASE_URL` and `PORT` use `http://localhost:3000`.
   Leave optional provider settings blank unless you are testing that
   integration. The complete variable list is in [`.env.example`](.env.example).

3. Apply local migrations and start the API:

   ```sh
   npm run db:migrate:local
   npm run dev
   ```

4. Check `http://localhost:3000/health` for liveness and
   `http://localhost:3000/health/ready` for database readiness. The
   development API serves interactive documentation at
   `http://localhost:3000/docs` and its OpenAPI schema at
   `http://localhost:3000/openapi.json`.

On PowerShell, use `Copy-Item .env.example .env` in place of `cp`. To stop
the local Supabase stack, run `npm run supabase:stop`.

## API areas

The versioned router covers auth, workspaces, participants, meetings, tasks,
subscriptions/billing, RevenueCat webhooks, calendar, AI, exports, insights,
and account actions. The generated [OpenAPI snapshot](docs/openapi.json)
contains the request and response contracts. Authenticated workspace reads
and writes are scoped to membership and workspace ownership.

The mobile app points `VITE_API_BASE_URL` at this service's origin. For a
physical device or emulator, use a reachable address and set CORS only for
trusted browser origins; native apps do not depend on browser CORS.

## Integrations and secrets

The local core API needs Supabase and the backend token secrets. AI recaps,
native billing, Google Calendar, and email flows need their respective provider
configuration. Production requires additional settings validated by
`src/config/env.ts`; consult [deployment notes](docs/deployment.md) before
deploying.

Never commit `.env` files or expose `SUPABASE_SERVICE_ROLE_KEY`,
`REVENUECAT_API_KEY`, webhook secrets, OpenAI keys, Google OAuth client
secrets, or SMTP credentials to the mobile repository. The frontend's public
RevenueCat SDK key is separate from the backend RevenueCat API key.

## Verify the source

```sh
npm run typecheck
npm test
npm run openapi:check
npm run build
```

`npm run ci` runs the first three checks. Tests use isolated fixtures and
must not use production credentials. Local database behavior can be checked
with `npm run db:verify:local` after starting Supabase.

## License

Source code in this repository is licensed under the
[Mozilla Public License 2.0](LICENSE).
