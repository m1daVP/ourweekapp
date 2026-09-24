-- Resolve PL/pgSQL output-column ambiguity in the AI claim and finalization RPCs.
-- The explicit per-function directive is deterministic and does not require changing
-- the cluster-wide plpgsql.variable_conflict setting.

create or replace function public.claim_ai_summary_generation(
  p_workspace_id uuid,
  p_meeting_id uuid,
  p_user_id uuid,
  p_provider text,
  p_input_hash text
)
returns table (
  claim_status text,
  id uuid,
  workspace_id uuid,
  user_id uuid,
  meeting_id uuid,
  provider text,
  status text,
  input_hash text,
  created_at timestamptz,
  completed_at timestamptz,
  error_code text,
  generated_summary jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_request public.ai_summary_requests%rowtype;
begin
  if p_workspace_id is null
    or p_meeting_id is null
    or p_user_id is null
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_input_hash), '') is null then
    raise exception using
      errcode = '22023',
      message = 'invalid AI summary claim input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_workspace_id::text || ':' || p_meeting_id::text || ':' || p_input_hash,
    0
  ));

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'completed'
    and generated_summary is not null
  order by created_at desc, id desc
  limit 1;

  if found then
    return query select
      'completed',
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'pending'
  order by created_at asc, id asc
  limit 1;

  if found then
    return query select
      'pending',
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  insert into public.ai_summary_requests (
    workspace_id,
    user_id,
    meeting_id,
    provider,
    status,
    input_hash
  ) values (
    p_workspace_id,
    p_user_id,
    p_meeting_id,
    p_provider,
    'pending',
    p_input_hash
  ) returning * into v_request;

  return query select
    'created',
    v_request.id,
    v_request.workspace_id,
    v_request.user_id,
    v_request.meeting_id,
    v_request.provider,
    v_request.status,
    v_request.input_hash,
    v_request.created_at,
    v_request.completed_at,
    v_request.error_code,
    v_request.generated_summary;
end;
$$;

revoke all on function public.claim_ai_summary_generation(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_ai_summary_generation(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.claim_ai_summary_generation_v2(
  p_workspace_id uuid,
  p_meeting_id uuid,
  p_user_id uuid,
  p_provider text,
  p_input_hash text,
  p_effective_model text,
  p_prompt_version text
)
returns table (
  claim_status text,
  id uuid,
  workspace_id uuid,
  user_id uuid,
  meeting_id uuid,
  provider text,
  status text,
  input_hash text,
  effective_model text,
  prompt_version text,
  created_at timestamptz,
  completed_at timestamptz,
  error_code text,
  generated_summary jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_request public.ai_summary_requests%rowtype;
begin
  if p_workspace_id is null
    or p_meeting_id is null
    or p_user_id is null
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_input_hash), '') is null
    or nullif(btrim(p_effective_model), '') is null
    or nullif(btrim(p_prompt_version), '') is null then
    raise exception using
      errcode = '22023',
      message = 'invalid AI summary claim input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_workspace_id::text || ':' || p_meeting_id::text || ':' || p_input_hash,
    0
  ));

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'completed'
    and generated_summary is not null
  order by created_at desc, id desc
  limit 1;

  if found then
    return query select
      'completed',
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.effective_model,
      v_request.prompt_version,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'pending'
  order by created_at asc, id asc
  limit 1;

  if found then
    return query select
      'pending',
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.effective_model,
      v_request.prompt_version,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  insert into public.ai_summary_requests (
    workspace_id,
    user_id,
    meeting_id,
    provider,
    status,
    input_hash,
    effective_model,
    prompt_version
  ) values (
    p_workspace_id,
    p_user_id,
    p_meeting_id,
    p_provider,
    'pending',
    p_input_hash,
    p_effective_model,
    p_prompt_version
  ) returning * into v_request;

  return query select
    'created',
    v_request.id,
    v_request.workspace_id,
    v_request.user_id,
    v_request.meeting_id,
    v_request.provider,
    v_request.status,
    v_request.input_hash,
    v_request.effective_model,
    v_request.prompt_version,
    v_request.created_at,
    v_request.completed_at,
    v_request.error_code,
    v_request.generated_summary;
end;
$$;

revoke all on function public.claim_ai_summary_generation_v2(
  uuid, uuid, uuid, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.claim_ai_summary_generation_v2(
  uuid, uuid, uuid, text, text, text, text
) to service_role;

create or replace function public.claim_ai_summary_generation_v3(
  p_workspace_id uuid,
  p_meeting_id uuid,
  p_user_id uuid,
  p_provider text,
  p_input_hash text,
  p_effective_model text,
  p_prompt_version text,
  p_user_limit integer,
  p_workspace_limit integer,
  p_window_seconds integer
)
returns table (
  claim_status text,
  rate_limit_scope text,
  rate_limit_reset_at timestamptz,
  id uuid,
  workspace_id uuid,
  user_id uuid,
  meeting_id uuid,
  provider text,
  status text,
  input_hash text,
  effective_model text,
  prompt_version text,
  created_at timestamptz,
  completed_at timestamptz,
  error_code text,
  generated_summary jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_request public.ai_summary_requests%rowtype;
  v_window_start timestamptz;
  v_user_count bigint;
  v_workspace_count bigint;
  v_user_oldest timestamptz;
  v_workspace_oldest timestamptz;
begin
  if p_workspace_id is null
    or p_meeting_id is null
    or p_user_id is null
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_input_hash), '') is null
    or nullif(btrim(p_effective_model), '') is null
    or nullif(btrim(p_prompt_version), '') is null
    or p_user_limit is null
    or p_user_limit < 1
    or p_workspace_limit is null
    or p_workspace_limit < 1
    or p_window_seconds is null
    or p_window_seconds < 1 then
    raise exception using
      errcode = '22023',
      message = 'invalid AI summary claim input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'completed'
    and generated_summary is not null
  order by created_at desc, id desc
  limit 1;

  if found then
    return query select
      'completed',
      null::text,
      null::timestamptz,
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.effective_model,
      v_request.prompt_version,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  select * into v_request
  from public.ai_summary_requests
  where workspace_id = p_workspace_id
    and meeting_id = p_meeting_id
    and input_hash = p_input_hash
    and status = 'pending'
  order by created_at asc, id asc
  limit 1;

  if found then
    return query select
      'pending',
      null::text,
      null::timestamptz,
      v_request.id,
      v_request.workspace_id,
      v_request.user_id,
      v_request.meeting_id,
      v_request.provider,
      v_request.status,
      v_request.input_hash,
      v_request.effective_model,
      v_request.prompt_version,
      v_request.created_at,
      v_request.completed_at,
      v_request.error_code,
      v_request.generated_summary;
    return;
  end if;

  v_window_start := clock_timestamp() - make_interval(secs => p_window_seconds);

  select
    count(*) filter (where request.user_id = p_user_id),
    min(request.created_at) filter (where request.user_id = p_user_id),
    count(*),
    min(request.created_at)
  into
    v_user_count,
    v_user_oldest,
    v_workspace_count,
    v_workspace_oldest
  from public.ai_summary_requests as request
  where request.workspace_id = p_workspace_id
    and request.status in ('pending', 'completed')
    and request.created_at > v_window_start;

  if v_user_count >= p_user_limit then
    return query select
      'rate_limited',
      'user',
      v_user_oldest + make_interval(secs => p_window_seconds),
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz,
      null::text,
      null::jsonb;
    return;
  end if;

  if v_workspace_count >= p_workspace_limit then
    return query select
      'rate_limited',
      'workspace',
      v_workspace_oldest + make_interval(secs => p_window_seconds),
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz,
      null::text,
      null::jsonb;
    return;
  end if;

  insert into public.ai_summary_requests (
    workspace_id,
    user_id,
    meeting_id,
    provider,
    status,
    input_hash,
    effective_model,
    prompt_version
  ) values (
    p_workspace_id,
    p_user_id,
    p_meeting_id,
    p_provider,
    'pending',
    p_input_hash,
    p_effective_model,
    p_prompt_version
  ) returning * into v_request;

  return query select
    'created',
    null::text,
    null::timestamptz,
    v_request.id,
    v_request.workspace_id,
    v_request.user_id,
    v_request.meeting_id,
    v_request.provider,
    v_request.status,
    v_request.input_hash,
    v_request.effective_model,
    v_request.prompt_version,
    v_request.created_at,
    v_request.completed_at,
    v_request.error_code,
    v_request.generated_summary;
end;
$$;

revoke all on function public.claim_ai_summary_generation_v3(
  uuid, uuid, uuid, text, text, text, text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.claim_ai_summary_generation_v3(
  uuid, uuid, uuid, text, text, text, text, integer, integer, integer
) to service_role;

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
#variable_conflict use_column
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


