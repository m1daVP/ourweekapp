alter table public.ai_summary_requests
  add column if not exists effective_model text,
  add column if not exists prompt_version text,
  add constraint ai_summary_requests_effective_model_not_blank
    check (effective_model is null or btrim(effective_model) <> ''),
  add constraint ai_summary_requests_prompt_version_not_blank
    check (prompt_version is null or btrim(prompt_version) <> '');

create function public.claim_ai_summary_generation_v2(
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
