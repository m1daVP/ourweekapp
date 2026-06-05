# Backend Architecture

This backend is a single Fastify service written in TypeScript. Keep it organized around the HTTP API contract and the product domains instead of adding broad framework-style abstractions.

## Runtime Flow

The application starts in `src/server.ts`.

- `src/server.ts` builds the app, starts listening on `env.HOST` and `env.PORT`, and handles shutdown signals.
- `src/app.ts` creates the Fastify instance, configures validation and serialization, registers global plugins, installs the error handler, adds the request ID response header, and mounts routes.
- `src/routes/health.routes.ts` exposes unversioned health checks.
- `src/routes/v1.routes.ts` is the versioned API router mounted at `/v1`.

Do not put business logic in `server.ts` or `app.ts`. Those files should stay focused on application wiring.

## Directory Responsibilities

Use these folders consistently:

- `src/config`: environment parsing and runtime configuration. All environment variables should be validated here with Zod.
- `src/plugins`: Fastify plugins and app decorations, such as the Supabase client.
- `src/routes`: top-level route composition only. Version routing belongs here.
- `src/modules`: product-domain modules. Each module owns its route handlers, services, schemas, provider clients, and module-specific helpers.
- `src/shared`: cross-domain code that is intentionally reused by several modules.
- `src/repositories`: legacy or future top-level repository location. Prefer colocated repositories under modules unless the repository is truly shared.
- `src/services`: legacy or future top-level service location. Prefer colocated services under modules unless the service is truly shared.
- `src/types`: TypeScript declaration merging and app-wide type augmentation.
- `supabase/migrations`: Supabase/PostgreSQL schema migrations.
- `tests`: Vitest tests.

Prefer adding code close to the domain that uses it. Move code to `src/shared` only after at least two domains need it and the shared contract is clear.

## Module Pattern

Each backend domain should live under `src/modules/<domain>`.

Current modules:

- `auth`: sign-up, sign-in, token issuing, refresh token rotation, password hashing, and authenticated user context.
- `billing`: RevenueCat webhooks, entitlement checks, plan state, and subscription API behavior.
- `calendar`: Google OAuth connection, calendar sync, and calendar event integration.
- `ai`: backend-owned AI provider calls and summary generation.

Expected module file types:

- `<domain>.routes.ts`: Fastify route registration and route schemas.
- `<domain>.service.ts`: business rules and orchestration.
- `<domain>.repository.ts`: database reads/writes for that domain.
- `<domain>.schema.ts`: Zod request, response, and DTO schemas.
- `<provider>.client.ts`: external service clients such as OpenAI, Google, or RevenueCat.

Route handlers should stay thin: validate input through route schemas, read auth context, call services, and return DTOs. Put business decisions in services and database details in repositories.

## Routing

The public API is versioned under `/v1`.

- Register new product routes in `src/routes/v1.routes.ts`.
- Keep `/health` outside `/v1` for infrastructure checks.
- Use `FastifyPluginAsyncZod` for route modules so request and response schemas stay typed.
- Use Zod schemas for request bodies, params, query strings, and response DTOs where practical.
- Return stable API DTOs in `camelCase`; keep database fields in `snake_case`.

When adding a new endpoint, update the module route file first, then add any service, repository, and schema files needed by that route.

## Shared Code

Shared code must have a narrow purpose.

Current shared areas:

- `src/shared/errors`: `ApiError` and the global safe error handler.
- `src/shared/schemas`: shared DTO schemas such as the standard error response.
- `src/shared/auth`: authenticated request context types.
- `src/shared/sync`: sync conflict DTOs and conflict reason enums.
- `src/shared/repositories`: shared repository helpers when they become necessary.

Use `ApiError` for expected application errors. Do not leak raw database, provider, token, or AI errors to mobile clients. Validation failures are converted to a safe `422` response by the global error handler.

## Auth And Request Context

Authenticated routes should rely on a request-level auth context instead of repeatedly decoding tokens in handlers.

The intended flow is:

1. Parse `Authorization: Bearer <accessToken>`.
2. Verify the access token.
3. Load the user, session, workspace membership, role, and plan state.
4. Attach the result to `request.auth`.
5. Scope all workspace-owned reads and writes by `request.auth.workspaceId`.

The `FastifyRequest.auth` type is declared in `src/types/fastify.d.ts`. Keep auth, permission, billing entitlement, and ownership checks centralized instead of scattering them across route handlers.

## Database Access

The service uses Supabase as the database platform and PostgreSQL as the database.

- The Supabase service-role client is registered by `src/plugins/supabase.ts`.
- Service-role keys are backend-only secrets and must never appear in frontend or client-side code.
- Repositories should wrap all database access and map database rows to API DTOs.
- Every workspace-owned query must include `workspace_id` filtering.
- Soft-deleted rows should be excluded by default unless the endpoint explicitly needs them.
- Provider tokens, password hashes, refresh token hashes, and internal metadata must not be returned in API responses.

The initial schema includes users, sessions, workspaces, workspace members, invitations, participants, meetings, tasks, agreements, task review decisions, subscriptions, calendar connections, calendar events, and AI summary requests.

## Migrations

Schema changes belong in `supabase/migrations`.

Follow the migration rules in this repository:

- Keep migrations small and focused.
- Do not edit migrations that may already have been applied to a shared environment.
- Prefer expand, migrate, contract for risky changes.
- Add nullable columns before backfilling and adding constraints.
- Review RLS, ownership, auth, billing, permission, and audit impact carefully.
- Test migrations locally before merging.

Fastify code must tolerate rolling deploys. Do not deploy code that assumes a new table or column exists before the migration is guaranteed to be applied.

## External Integrations

External providers are accessed only from the backend.

- OpenAI client setup belongs in `src/modules/ai`.
- RevenueCat client setup belongs in `src/modules/billing`.
- Google OAuth client setup belongs in `src/modules/calendar`.
- Provider API keys, webhook secrets, OAuth secrets, and service account credentials must stay server-side.

Provider-specific errors should be logged safely and converted to stable API errors.

## Environment Configuration

All environment variables are parsed in `src/config/env.ts`.

- Required app and security configuration should fail fast during startup.
- Optional integrations should expose derived booleans such as `AI_CONFIGURED`, `REVENUECAT_CONFIGURED`, `GOOGLE_OAUTH_CONFIGURED`, and `SMTP_CONFIGURED`.
- Do not read `process.env` directly outside the config module unless there is a strong reason.
- Keep `.env.example` synchronized when adding or renaming variables.

## Testing

Use Vitest for automated tests.

Add tests close to the behavior being changed:

- Route tests for request validation, status codes, response DTOs, and auth behavior.
- Service tests for business rules and edge cases.
- Repository tests or integration tests for query shape, workspace scoping, soft deletes, and data mapping.
- Migration tests or local migration runs for schema changes.

At minimum, run:

```bash
npm run typecheck
npm test
```

Run `npm run build` before deployment-oriented changes.

## Adding A Backend Feature

Use this sequence for new backend behavior:

1. Identify the API contract and DTOs.
2. Add or update Zod schemas.
3. Add repository methods for database access.
4. Add service logic for business rules.
5. Register route handlers in the domain module.
6. Mount new domain routes from `src/routes/v1.routes.ts` if needed.
7. Add migrations when the schema changes.
8. Add focused tests for the behavior and any risky data access.
9. Run typecheck and tests.

Keep endpoint implementation boring and explicit. The backend is small enough that clear modules, typed schemas, and consistent repository boundaries are more valuable than generic abstractions.
