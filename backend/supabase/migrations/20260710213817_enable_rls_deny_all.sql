-- Enable deny-all row level security on every application table.
--
-- The API accesses the database exclusively through the Supabase
-- service-role key, which bypasses RLS, so no policies are needed.
-- Enabling RLS without policies denies all access for the `anon` and
-- `authenticated` PostgREST roles, protecting sensitive columns such as
-- users.password_hash and sessions.refresh_token_hash even if the
-- Supabase Data API is (or becomes) enabled for this project.
--
-- As defense in depth we also revoke the default PostgREST grants on all
-- existing tables and sequences in `public`, and revoke the default
-- privileges so future tables and sequences are not exposed either.

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.auth_identities enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.meetings enable row level security;
alter table public.participants enable row level security;
alter table public.tasks enable row level security;
alter table public.agreements enable row level security;
alter table public.task_review_decisions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;
alter table public.ai_summary_requests enable row level security;

-- Defense in depth: drop the default PostgREST grants for the anon and
-- authenticated roles on everything that already exists in `public`.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- And make sure objects created by future migrations are not granted to
-- these roles by default. Note: `alter default privileges` only affects
-- objects created by the role executing this statement (the migration
-- role), which is the same role that creates all objects in these
-- migrations, so this covers future migration-created tables/sequences.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
