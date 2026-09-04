create or replace function public.reconcile_abandoned_assistant_recap_requests(
  p_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'workspace ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  with recovered_requests as (
    update public.ai_summary_requests as request
    set status = 'failed',
        completed_at = clock_timestamp(),
        error_code = 'ai_summary_request_abandoned'
    where request.workspace_id = p_workspace_id
      and request.status = 'pending'
      and request.created_at < clock_timestamp() - interval '15 minutes'
      and not exists (
        select 1
        from public.assistant_recap_credit_reservations as credit
        where credit.workspace_id = request.workspace_id
          and credit.ai_summary_request_id = request.id
          and (
            credit.state <> 'reserved'
            or credit.reserved_at >= clock_timestamp() - interval '15 minutes'
          )
      )
    returning request.id
  )
  update public.assistant_recap_credit_reservations as credit
  set state = 'released', released_at = clock_timestamp()
  from recovered_requests
  where credit.workspace_id = p_workspace_id
    and credit.ai_summary_request_id = recovered_requests.id
    and credit.state = 'reserved'
    and credit.reserved_at < clock_timestamp() - interval '15 minutes';
end;
$$;

revoke all on function public.reconcile_abandoned_assistant_recap_requests(uuid)
  from public, anon, authenticated;

grant execute on function public.reconcile_abandoned_assistant_recap_requests(uuid)
  to service_role;

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

  perform public.reconcile_abandoned_assistant_recap_requests(p_workspace_id);
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

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

revoke all on function public.reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.reserve_assistant_recap_credit(uuid, uuid, timestamptz, integer)
  to service_role;
