create function public.claim_ai_summary_generation_v3(
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
