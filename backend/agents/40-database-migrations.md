# Database Migrations Guidelines

## General Rules

- Treat migrations as production code. A bad migration can break the app even when backend code is correct.
- Keep all migrations in version control.
- Never edit a migration that was already applied to a shared environment such as staging or production. Create a new migration instead.
- Keep migrations small and focused. One migration should usually represent one logical change.
- Prefer backward-compatible changes: add new columns/tables first, update code, backfill data, and only then remove old columns in a later migration.
- Avoid destructive changes in the same release where the application starts using a new schema.
- Do not make manual production DB changes unless it is an emergency. If a manual hotfix is done, create a matching migration afterward to avoid schema drift.
- Always test migrations locally before merging.
- Risky migrations must be tested on staging or on production-like data before production deployment.
- Large data changes should be batched, not executed as one huge update.
- Have a rollback or recovery plan for every risky migration.
- Create a backup before migrations that modify or delete important production data.

Useful references:

- Rails migration concept: https://guides.rubyonrails.org/active_record_migrations.html
- Flyway versioned migrations: https://documentation.red-gate.com/fd/versioned-migrations-273973333.html
- Liquibase migration best practices: https://www.liquibase.com/blog/database-change-management-best-practices
- Prisma development vs production migrations: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production

---

## Safe Migration Pattern

Prefer the **expand -> migrate -> contract** pattern.

### 1. Expand

Add new schema without breaking existing code.

Examples:

- add nullable column
- add new table
- add new enum value
- add new index carefully
- add new relationship without immediately removing the old one

### 2. Migrate

Update backend code and move data safely.

Examples:

- Fastify handlers write to both old and new fields temporarily
- background job or script backfills existing rows
- API responses support both old and new shape during transition

### 3. Contract

Remove old schema only after the new code is stable.

Examples:

- remove deprecated column
- remove old table
- remove fallback code
- remove old API response field if it is no longer needed

Reference: https://wasp.sh/blog/2025/04/02/an-introduction-to-database-migrations

---

## Fastify-Specific Rules

- Do not assume the database migration and Fastify deployment happen at exactly the same moment.
- New Fastify code must be compatible with the currently deployed database schema during rollout.
- Avoid deploying Fastify code that requires a column/table before the migration is guaranteed to be applied.
- If a field is being renamed, support both old and new field names temporarily.
- Validate request and response schemas so API contracts do not silently break after DB changes.
- Keep database access logic centralized where possible, so schema changes do not require scattered edits across many route handlers.
- If a migration changes auth, permissions, user ownership, billing, or audit-related data, treat it as high risk.

Fastify validation reference: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/

---

## Supabase / PostgreSQL Rules

- Use Supabase migrations for schema changes instead of changing production manually through the dashboard.
- Keep local Supabase schema and remote environments synchronized through migrations.
- Be careful with Row Level Security policies. Schema changes can accidentally expose or block data.
- Review RLS policies whenever adding new tables, changing ownership columns, or modifying user/account relationships.
- For new tables containing user data, explicitly decide whether RLS should be enabled.
- Avoid long-running locks on large production tables.
- Add indexes intentionally and verify that they support real queries.
- Be careful when adding `NOT NULL`, `UNIQUE`, foreign key, or check constraints to existing tables with data.
- Prefer adding nullable columns first, backfilling, then adding constraints in a later migration.
- For large indexes in PostgreSQL, consider concurrent index creation when appropriate.
- Never expose service role keys in frontend or client-side code. Backend-only secrets must stay server-side.

Supabase references:

- Supabase CLI migrations: https://supabase.com/docs/guides/local-development/cli/managing-migrations
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys

PostgreSQL references:

- PostgreSQL indexes: https://www.postgresql.org/docs/current/indexes.html
- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html

---

## Data Migration Rules

- Separate heavy data backfills from schema migrations when possible.
- Batch large updates by ID range or pagination.
- Make data migrations resumable if they may take a long time.
- Log progress for long-running scripts.
- Avoid external API calls inside database migrations.
- Avoid random or time-dependent values unless they are intentional and deterministic enough for all environments.
- Before adding a constraint, verify that existing data already satisfies it.

Example safer flow for adding a required field:

1. Add the column as nullable.
2. Deploy Fastify code that writes the new field.
3. Backfill old records.
4. Verify no rows have `NULL`.
5. Add the `NOT NULL` constraint.
6. Remove fallback logic later.

Django data migration guidance: https://django.readthedocs.io/en/5.2.x/howto/writing-migrations.html

---

## Risky Changes

Treat these as high risk:

- dropping columns or tables
- renaming columns directly
- changing column types on large tables
- adding `NOT NULL` to existing columns
- adding `UNIQUE` constraints to dirty data
- adding foreign keys to large existing tables
- changing RLS policies
- changing auth/user ownership logic
- changing billing, invoice, payment, audit, or permission-related data
- running large `UPDATE` or `DELETE` queries
- creating indexes on large production tables

For risky migrations, require:

- local test
- staging test
- backup plan
- rollback or forward-fix plan
- PR review focused specifically on DB impact

---

## Migration PR Checklist

Before merging migration-related work, check:

- [ ] Migration is committed to version control.
- [ ] Migration is small and focused.
- [ ] No already-applied migration was edited.
- [ ] Change is backward-compatible where possible.
- [ ] Fastify code works during rolling deployment.
- [ ] Supabase RLS impact was reviewed.
- [ ] Existing production data is compatible with new constraints.
- [ ] Large updates are batched.
- [ ] Indexes are justified by real queries.
- [ ] Risky changes have a backup/recovery plan.
- [ ] Migration was tested locally.
- [ ] Migration was tested on staging if risky.
- [ ] No secrets are exposed to frontend/client code.
- [ ] Manual production DB changes are avoided or reconciled with a migration.

---

## Preferred Deployment Flow

1. Create migration locally.
2. Run migration locally.
3. Run tests.
4. Open PR.
5. Review DB impact.
6. Apply to staging.
7. Test Fastify API behavior.
8. Backup production if needed.
9. Apply migration through deployment process.
10. Deploy backend code.
11. Monitor logs, API errors, slow queries, and Supabase/PostgreSQL metrics.
12. Apply cleanup migration later only after the new version is stable.
