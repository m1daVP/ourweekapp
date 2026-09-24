alter table public.assistant_recap_credit_reservations
  add column if not exists allowance_period_ends_at timestamptz;

create index if not exists assistant_recap_credit_reservations_allowance_idx
  on public.assistant_recap_credit_reservations (
    workspace_id,
    allowance_period_ends_at,
    state,
    reserved_at
  );

create or replace function public.reserve_assistant_recap_credit(
  p_workspace_id uuid,
  p_ai_summary_request_id uuid,
  p_allowance_period_ends_at timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_active_credit_count integer;
begin
  if p_workspace_id is null or p_ai_summary_request_id is null or p_limit < 1 then
    raise exception using errcode = '22023', message = 'invalid recap allowance input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  update public.assistant_recap_credit_reservations
  set state = 'released', released_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and state = 'reserved'
    and allowance_period_ends_at is not distinct from p_allowance_period_ends_at
    and reserved_at < clock_timestamp() - interval '15 minutes';

  select state into v_state
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id
  for update;

  if found then
    return v_state in ('reserved', 'settled');
  end if;

  select count(*) into v_active_credit_count
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and allowance_period_ends_at is not distinct from p_allowance_period_ends_at
    and state in ('reserved', 'settled');

  if v_active_credit_count >= p_limit then
    return false;
  end if;

  insert into public.assistant_recap_credit_reservations (
    workspace_id, ai_summary_request_id, state, allowance_period_ends_at
  ) values (
    p_workspace_id, p_ai_summary_request_id, 'reserved', p_allowance_period_ends_at
  );

  return true;
end;
$$;

revoke all on function public.reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer) to service_role;

create or replace function public.enforce_household_member_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_current_count integer;
  v_is_premium boolean;
  v_workspace_is_active boolean;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 1));
  select exists (
    select 1 from public.workspaces
    where id = new.workspace_id
      and deleted_at is null
  ) into v_workspace_is_active;

  if not v_workspace_is_active then
    raise exception using message = 'workspace_not_found';
  end if;

  select exists (
    select 1 from public.subscriptions
    where workspace_id = new.workspace_id
      and plan_type = 'premium'
      and status in ('active', 'trialing', 'grace_period')
      and (expires_at is null or expires_at > clock_timestamp())
  ) into v_is_premium;
  v_limit := case when v_is_premium then 8 else 4 end;
  select count(*) into v_current_count
  from public.workspace_members
  where workspace_id = new.workspace_id
    and status = 'active'
    and user_id <> new.user_id;

  if v_current_count >= v_limit then
    raise exception using
      message = 'household_member_limit_reached',
      detail = json_build_object('limit', v_limit, 'currentCount', v_current_count)::text;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_enforce_capacity on public.workspace_members;
create trigger workspace_members_enforce_capacity
before insert or update of status on public.workspace_members
for each row execute function public.enforce_household_member_capacity();
