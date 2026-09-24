alter table public.ai_summary_requests
  add column if not exists generated_summary jsonb;

create unique index ai_summary_requests_active_generation_unique_idx
  on public.ai_summary_requests (workspace_id, meeting_id, input_hash)
  where status = 'pending' and input_hash is not null;

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
