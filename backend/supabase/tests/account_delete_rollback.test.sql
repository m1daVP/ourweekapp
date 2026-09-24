begin;

select no_plan();

insert into public.users (id, email, email_normalized, display_name, password_hash)
values (
  '00000000-0000-4000-8000-000000000701',
  'db-proof-rollback-owner@example.invalid',
  'db-proof-rollback-owner@example.invalid',
  'Database proof rollback owner',
  'db-proof-password-hash'
);

insert into public.workspaces (id, name, owner_id)
values (
  '00000000-0000-4000-8000-000000000702',
  'db-proof-rollback-workspace',
  '00000000-0000-4000-8000-000000000701'
);

insert into public.workspace_members (
  workspace_id, user_id, display_name, email, role, status
) values (
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701',
  'Database proof rollback owner',
  'db-proof-rollback-owner@example.invalid',
  'owner',
  'active'
);

insert into public.sessions (
  id, user_id, refresh_token_hash, expires_at, revoked_at
) values
(
  '00000000-0000-4000-8000-000000000703',
  '00000000-0000-4000-8000-000000000701',
  'db-proof-active-session',
  '2026-09-10T12:00:00Z',
  null
),
(
  '00000000-0000-4000-8000-000000000704',
  '00000000-0000-4000-8000-000000000701',
  'db-proof-old-session',
  '2026-09-10T12:00:00Z',
  '2026-09-01T10:00:00Z'
);

insert into public.calendar_connections (
  id, workspace_id, user_id, provider, connected_account_email,
  access_token_encrypted, refresh_token_encrypted, token_expires_at, state
) values (
  '00000000-0000-4000-8000-000000000705',
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701',
  'google',
  'db-proof-rollback-owner@example.invalid',
  'db-proof-access',
  'db-proof-refresh',
  '2026-09-10T12:00:00Z',
  'connected'
);

create function pg_temp.fail_account_delete_user_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'db_proof_forced_failure';
end;
$$;

create trigger db_proof_fail_account_delete
before update of deleted_at on public.users
for each row
when (old.id = '00000000-0000-4000-8000-000000000701'::uuid)
execute function pg_temp.fail_account_delete_user_update();

select throws_ok(
  $$select public.account_delete(
    '00000000-0000-4000-8000-000000000701',
    '2026-09-09T10:00:00Z'
  )$$,
  'P0001',
  'db_proof_forced_failure',
  'account deletion reports the injected final-step failure'
);

select is(
  (select revoked_at from public.sessions where id = '00000000-0000-4000-8000-000000000703'),
  null::timestamptz,
  'active session revocation rolls back'
);

select is(
  (select revoked_at from public.sessions where id = '00000000-0000-4000-8000-000000000704'),
  '2026-09-01T10:00:00Z'::timestamptz,
  'older session revocation remains unchanged'
);

select is(
  (select access_token_encrypted from public.calendar_connections where id = '00000000-0000-4000-8000-000000000705'),
  'db-proof-access',
  'calendar access token clearing rolls back'
);

select is(
  (select refresh_token_encrypted from public.calendar_connections where id = '00000000-0000-4000-8000-000000000705'),
  'db-proof-refresh',
  'calendar refresh token clearing rolls back'
);

select is(
  (select state from public.calendar_connections where id = '00000000-0000-4000-8000-000000000705'),
  'connected',
  'calendar state change rolls back'
);

select is(
  (select status from public.workspace_members
   where workspace_id = '00000000-0000-4000-8000-000000000702'
     and user_id = '00000000-0000-4000-8000-000000000701'),
  'active',
  'membership removal rolls back'
);

select is(
  (select owner_id from public.workspaces where id = '00000000-0000-4000-8000-000000000702'),
  '00000000-0000-4000-8000-000000000701'::uuid,
  'workspace ownership change rolls back'
);

select is(
  (select deleted_at from public.workspaces where id = '00000000-0000-4000-8000-000000000702'),
  null::timestamptz,
  'workspace soft deletion rolls back'
);

select is(
  (select deleted_at from public.users where id = '00000000-0000-4000-8000-000000000701'),
  null::timestamptz,
  'user soft deletion rolls back'
);

select * from finish();
rollback;
