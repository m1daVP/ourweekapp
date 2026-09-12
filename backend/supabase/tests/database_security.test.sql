begin;

select no_plan();

select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(array[
        'users', 'sessions', 'workspaces', 'workspace_members',
        'workspace_invitations', 'participants', 'meetings', 'tasks',
        'agreements', 'task_review_decisions', 'subscriptions',
        'calendar_connections', 'calendar_events', 'ai_summary_requests',
        'auth_identities', 'password_reset_tokens', 'assistant_settings',
        'assistant_recap_credit_reservations', 'assistant_follow_ups',
        'calendar_preferences'
      ])
      and relation.relrowsecurity
  ),
  20,
  'every public application table enables row level security'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      and table_name = any(array[
        'users', 'sessions', 'workspaces', 'workspace_members',
        'workspace_invitations', 'participants', 'meetings', 'tasks',
        'agreements', 'task_review_decisions', 'subscriptions',
        'calendar_connections', 'calendar_events', 'ai_summary_requests',
        'auth_identities', 'password_reset_tokens', 'assistant_settings',
        'assistant_recap_credit_reservations', 'assistant_follow_ups',
        'calendar_preferences'
      ])
  ),
  0,
  'anon and authenticated have no application table DML grants'
);

select ok(
  not has_function_privilege('anon', 'public.account_delete(uuid,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.account_delete(uuid,timestamptz)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.account_delete(uuid,timestamptz)', 'EXECUTE'),
  'account deletion is service-role only'
);

select ok(
  not has_function_privilege('anon', 'public.account_restore(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.account_restore(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.account_restore(uuid)', 'EXECUTE'),
  'account restoration is service-role only'
);

select ok(
  not has_function_privilege('anon', 'public.confirm_password_reset(text,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.confirm_password_reset(text,text,timestamptz)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.confirm_password_reset(text,text,timestamptz)', 'EXECUTE'),
  'password reset confirmation is service-role only'
);

select ok(
  not has_function_privilege('anon', 'public.claim_ai_summary_generation_v3(uuid,uuid,uuid,text,text,text,text,integer,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_ai_summary_generation_v3(uuid,uuid,uuid,text,text,text,text,integer,integer,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.claim_ai_summary_generation_v3(uuid,uuid,uuid,text,text,text,text,integer,integer,integer)', 'EXECUTE'),
  'AI claiming is service-role only'
);

set local role anon;
select throws_ok('select id from public.users limit 1', '42501', null, 'anon cannot select users');
select throws_ok(
  $$insert into public.users (id, email, email_normalized, password_hash)
    values ('00000000-0000-4000-8000-000000000601', 'db-proof-anon@example.invalid', 'db-proof-anon@example.invalid', 'hash')$$,
  '42501',
  null,
  'anon cannot insert users'
);
select throws_ok(
  $$update public.users set display_name = 'denied'
    where id = '00000000-0000-4000-8000-000000000601'$$,
  '42501',
  null,
  'anon cannot update users'
);
select throws_ok(
  $$delete from public.users
    where id = '00000000-0000-4000-8000-000000000601'$$,
  '42501',
  null,
  'anon cannot delete users'
);
reset role;

set local role authenticated;
select throws_ok('select id from public.users limit 1', '42501', null, 'authenticated cannot select users');
select throws_ok(
  $$insert into public.users (id, email, email_normalized, password_hash)
    values ('00000000-0000-4000-8000-000000000602', 'db-proof-auth@example.invalid', 'db-proof-auth@example.invalid', 'hash')$$,
  '42501',
  null,
  'authenticated cannot insert users'
);
select throws_ok(
  $$update public.users set display_name = 'denied'
    where id = '00000000-0000-4000-8000-000000000602'$$,
  '42501',
  null,
  'authenticated cannot update users'
);
select throws_ok(
  $$delete from public.users
    where id = '00000000-0000-4000-8000-000000000602'$$,
  '42501',
  null,
  'authenticated cannot delete users'
);
reset role;

select * from finish();
rollback;
