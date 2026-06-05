# Supabase + PostgreSQL Rules

## Supabase Usage

- Use Supabase client only from backend/server-side code when using service role keys.
- Never expose service role keys to frontend or mobile clients.
- Keep Supabase initialization in a plugin or shared infrastructure module.
- Do not create multiple unnecessary Supabase clients per request unless needed.
- Use user-scoped queries where possible.

## PostgreSQL Data Rules

- Use correct data types.
- Prefer `uuid` or consistent ID strategy across the project.
- Use timestamps consistently.
- Use foreign keys for important relationships.
- Use indexes for common filters and joins.
- Avoid fetching more columns than needed.
- Avoid unbounded list queries.

## Row Level Security

- Review RLS policies whenever adding new tables.
- For user-owned data, ensure users can access only their own records.
- For family/account/team-owned data, always check the correct ownership key.
- Do not assume RLS alone is enough if backend uses service role.
- If service role bypasses RLS, authorization must be enforced in backend services.

## Query Rules

- Do not fetch broad datasets and filter sensitive data only in application memory.
- Always filter workspace-owned data by `workspace_id`.
- Filter user-owned data by `user_id` when it is not workspace-scoped.
- Use pagination for list endpoints.
- Use transactions/RPC/functions when multi-step writes must be atomic.
- Map database errors to application errors.

## Index Rules

Add indexes for:

- foreign keys used in joins
- ownership filters
- frequently searched fields
- frequently sorted fields

Do not add indexes blindly. Indexes improve reads but add write/storage cost.
