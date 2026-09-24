create or replace function public.finalize_ai_summary_generation(
  p_workspace_id uuid,
  p_request_id uuid,
  p_meeting_id uuid,
  p_expected_server_revision integer,
  p_generated_summary jsonb,
  p_completed_at timestamptz,
  p_input_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer
)
returns table (
  finalization_status text,
  meeting_id uuid,
  source_server_revision integer,
  server_revision integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_summary_requests%rowtype;
  v_credit public.assistant_recap_credit_reservations%rowtype;
  v_meeting public.meetings%rowtype;
begin
  if p_workspace_id is null
    or p_request_id is null
    or p_meeting_id is null
    or p_expected_server_revision is null
    or p_expected_server_revision < 1
    or p_generated_summary is null
    or p_completed_at is null then
    raise exception using
      errcode = '22023',
      message = 'invalid AI summary finalization input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  select * into v_request
  from public.ai_summary_requests
  where id = p_request_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'AI summary request not found';
  end if;

  if v_request.meeting_id <> p_meeting_id then
    raise exception using
      errcode = '22023',
      message = 'AI summary request meeting mismatch';
  end if;

  select * into v_credit
  from public.assistant_recap_credit_reservations
  where workspace_id = p_workspace_id
    and ai_summary_request_id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'AI summary request has no recap credit';
  end if;

  if v_request.status = 'completed' then
    select * into v_meeting
    from public.meetings
    where id = p_meeting_id
      and workspace_id = p_workspace_id
      and deleted_at is null
    for update;

    if not found
      or v_request.generated_summary is distinct from p_generated_summary
      or v_meeting.ai_summary is distinct from p_generated_summary
      or v_credit.state <> 'settled' then
      raise exception using
        errcode = '22023',
        message = 'AI summary finalization state mismatch';
    end if;

    return query select
      'completed',
      p_meeting_id,
      p_expected_server_revision,
      v_meeting.server_revision,
      v_meeting.updated_at;
    return;
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'AI summary request is not pending';
  end if;

  if v_credit.state <> 'reserved' then
    raise exception using
      errcode = '22023',
      message = 'AI summary request has no reserved recap credit';
  end if;

  update public.meetings
  set ai_summary = p_generated_summary,
      server_revision = p_expected_server_revision + 1
  where id = p_meeting_id
    and workspace_id = p_workspace_id
    and server_revision = p_expected_server_revision
    and deleted_at is null
  returning * into v_meeting;

  if not found then
    return query select
      'revision_conflict',
      p_meeting_id,
      p_expected_server_revision,
      null::integer,
      null::timestamptz;
    return;
  end if;

  update public.ai_summary_requests
  set status = 'completed',
      completed_at = p_completed_at,
      error_code = null,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      total_tokens = p_total_tokens,
      generated_summary = p_generated_summary
  where id = p_request_id
    and workspace_id = p_workspace_id;

  update public.assistant_recap_credit_reservations
  set state = 'settled',
      settled_at = clock_timestamp()
  where id = v_credit.id
    and workspace_id = p_workspace_id
    and state = 'reserved';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'AI summary request recap credit changed during finalization';
  end if;

  return query select
    'applied',
    p_meeting_id,
    p_expected_server_revision,
    v_meeting.server_revision,
    v_meeting.updated_at;
end;
$$;

revoke all on function public.finalize_ai_summary_generation(
  uuid, uuid, uuid, integer, jsonb, timestamptz, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.finalize_ai_summary_generation(
  uuid, uuid, uuid, integer, jsonb, timestamptz, integer, integer, integer
) to service_role;

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
            credit.state = 'settled'
            or (
              credit.state = 'reserved'
              and credit.reserved_at >= clock_timestamp() - interval '15 minutes'
            )
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
