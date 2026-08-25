alter table public.agreements
  add column if not exists responsible_user_id uuid;

alter table public.agreements
  add constraint agreements_workspace_responsible_user_fk
  foreign key (workspace_id, responsible_user_id)
  references public.workspace_members(workspace_id, user_id)
  on delete restrict;

create index agreements_workspace_responsible_user_idx
  on public.agreements (workspace_id, responsible_user_id)
  where responsible_user_id is not null and deleted_at is null;

create table public.assistant_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  weekly_meeting_weekday smallint,
  weekly_meeting_local_time time,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_settings_weekday_check
    check (weekly_meeting_weekday between 0 and 6),
  constraint assistant_settings_complete_cadence_check
    check (
      (weekly_meeting_weekday is null and weekly_meeting_local_time is null and timezone is null)
      or
      (weekly_meeting_weekday is not null and weekly_meeting_local_time is not null and timezone is not null)
    ),
  constraint assistant_settings_timezone_not_blank_check
    check (timezone is null or btrim(timezone) <> '')
);

create table public.assistant_recap_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_summary_request_id uuid not null unique references public.ai_summary_requests(id) on delete cascade,
  state text not null,
  reserved_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz,
  constraint assistant_recap_credit_reservations_state_check
    check (state in ('reserved', 'settled', 'released')),
  constraint assistant_recap_credit_reservations_state_timestamps_check
    check (
      (state = 'reserved' and settled_at is null and released_at is null)
      or (state = 'settled' and settled_at is not null and released_at is null)
      or (state = 'released' and settled_at is null and released_at is not null)
    )
);

create table public.assistant_follow_ups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  recipient_user_id uuid,
  state text not null default 'open',
  due_at timestamptz not null,
  review_after_at timestamptz,
  actioned_by_user_id uuid references public.users(id) on delete restrict,
  actioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_follow_ups_source_type_check
    check (source_type in ('task', 'agreement')),
  constraint assistant_follow_ups_state_check
    check (state in ('open', 'resolved', 'snoozed', 'carry_to_next_meeting')),
  constraint assistant_follow_ups_recipient_fk
    foreign key (workspace_id, recipient_user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete restrict,
  constraint assistant_follow_ups_action_metadata_check
    check (
      (actioned_by_user_id is null and actioned_at is null)
      or (actioned_by_user_id is not null and actioned_at is not null)
    )
);

create index assistant_recap_credit_reservations_workspace_state_idx
  on public.assistant_recap_credit_reservations (workspace_id, state, reserved_at);

create index assistant_follow_ups_workspace_due_idx
  on public.assistant_follow_ups (workspace_id, due_at asc, created_at asc)
  where state in ('open', 'snoozed', 'carry_to_next_meeting');

create index assistant_follow_ups_workspace_source_idx
  on public.assistant_follow_ups (workspace_id, source_type, source_id);

create unique index assistant_follow_ups_active_source_unique_idx
  on public.assistant_follow_ups (workspace_id, source_type, source_id)
  where state <> 'resolved';

create trigger assistant_settings_set_updated_at
before update on public.assistant_settings
for each row execute function public.set_updated_at();

create trigger assistant_follow_ups_set_updated_at
before update on public.assistant_follow_ups
for each row execute function public.set_updated_at();

alter table public.assistant_settings enable row level security;
alter table public.assistant_recap_credit_reservations enable row level security;
alter table public.assistant_follow_ups enable row level security;

create or replace function public.reserve_assistant_recap_credit(
  p_workspace_id uuid,
  p_ai_summary_request_id uuid
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
  if p_workspace_id is null or p_ai_summary_request_id is null then
    raise exception using
      errcode = '22023',
      message = 'workspace and AI summary request IDs are required';
  end if;

  update public.assistant_recap_credit_reservations
  set state = 'released', released_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and state = 'reserved'
    and reserved_at < clock_timestamp() - interval '15 minutes';

  select state
  into v_state
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id
  for update;

  if found then
    return v_state in ('reserved', 'settled');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  select state
  into v_state
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id;

  if found then
    return v_state in ('reserved', 'settled');
  end if;

  select count(*)
  into v_active_credit_count
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and state in ('reserved', 'settled');

  if v_active_credit_count >= 3 then
    return false;
  end if;

  insert into public.assistant_recap_credit_reservations (
    workspace_id,
    ai_summary_request_id,
    state
  ) values (
    p_workspace_id,
    p_ai_summary_request_id,
    'reserved'
  );

  return true;
end;
$$;

create or replace function public.settle_assistant_recap_credit(
  p_workspace_id uuid,
  p_ai_summary_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  update public.assistant_recap_credit_reservations
  set state = 'settled', settled_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id
    and state = 'reserved'
  returning state into v_state;

  if found then
    return true;
  end if;

  select state
  into v_state
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id;

  return v_state = 'settled';
end;
$$;

create or replace function public.release_assistant_recap_credit(
  p_workspace_id uuid,
  p_ai_summary_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.assistant_recap_credit_reservations
  set state = 'released', released_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_ai_summary_request_id
    and state = 'reserved';

  return found;
end;
$$;

revoke all on function public.reserve_assistant_recap_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.settle_assistant_recap_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_assistant_recap_credit(uuid, uuid) from public, anon, authenticated;

grant execute on function public.reserve_assistant_recap_credit(uuid, uuid) to service_role;
grant execute on function public.settle_assistant_recap_credit(uuid, uuid) to service_role;
grant execute on function public.release_assistant_recap_credit(uuid, uuid) to service_role;
