create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'background_jobs'
  ) then
    perform pgmq.create('background_jobs');
  end if;

  if not exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'background_jobs_dead_letter'
  ) then
    perform pgmq.create('background_jobs_dead_letter');
  end if;
end;
$$;

create or replace function public.enqueue_background_job(
  p_job jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id bigint;
begin
  if p_job is null or jsonb_typeof(p_job) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'background job must be a JSON object';
  end if;

  if octet_length(p_job::text) > 16384 then
    raise exception using
      errcode = '22023',
      message = 'background job exceeds the maximum size';
  end if;

  if p_delay_seconds is null
    or p_delay_seconds < 0
    or p_delay_seconds > 86400
  then
    raise exception using
      errcode = '22023',
      message = 'background job delay is out of range';
  end if;

  select sent.message_id
  into v_message_id
  from pgmq.send('background_jobs', p_job, p_delay_seconds) as sent(message_id);

  return v_message_id;
end;
$$;

create or replace function public.extend_background_job_visibility(
  p_msg_id bigint,
  p_visibility_timeout_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_msg_id is null or p_msg_id < 1 then
    raise exception using
      errcode = '22023',
      message = 'background job message ID is invalid';
  end if;

  if p_visibility_timeout_seconds is null
    or p_visibility_timeout_seconds < 1
    or p_visibility_timeout_seconds > 3600
  then
    raise exception using
      errcode = '22023',
      message = 'background job visibility timeout is out of range';
  end if;

  perform pgmq.set_vt(
    'background_jobs',
    p_msg_id,
    p_visibility_timeout_seconds
  );
  return found;
end;
$$;

create or replace function public.read_background_jobs(
  p_visibility_timeout_seconds integer,
  p_batch_size integer default 1
)
returns table (
  msg_id bigint,
  read_ct bigint,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_visibility_timeout_seconds is null
    or p_visibility_timeout_seconds < 1
    or p_visibility_timeout_seconds > 3600
  then
    raise exception using
      errcode = '22023',
      message = 'background job visibility timeout is out of range';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10 then
    raise exception using
      errcode = '22023',
      message = 'background job batch size is out of range';
  end if;

  return query
  select
    queued.msg_id,
    queued.read_ct::bigint,
    queued.enqueued_at,
    queued.vt,
    queued.message
  from pgmq.read(
    'background_jobs',
    p_visibility_timeout_seconds,
    p_batch_size
  ) as queued;
end;
$$;

create or replace function public.delete_background_job(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pgmq.delete('background_jobs', p_msg_id);
$$;

create or replace function public.dead_letter_background_job(
  p_msg_id bigint,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message jsonb;
  v_read_count bigint;
  v_payload jsonb;
begin
  if p_error_code is null
    or p_error_code !~ '^[a-z][a-z0-9_]{0,99}$'
  then
    raise exception using
      errcode = '22023',
      message = 'background job error code is invalid';
  end if;

  select queued.message, queued.read_ct
  into v_message, v_read_count
  from pgmq.q_background_jobs as queued
  where queued.msg_id = p_msg_id
  for update;

  if not found then
    return false;
  end if;

  v_payload := coalesce(v_message -> 'payload', 'null'::jsonb);

  perform pgmq.send(
    'background_jobs_dead_letter',
    jsonb_build_object(
      'sourceMessageId', p_msg_id,
      'jobType', left(v_message ->> 'type', 100),
      'jobVersion', case
        when (v_message ->> 'version') ~ '^[0-9]{1,9}$'
          then (v_message ->> 'version')::integer
        else null
      end,
      'idempotencyKey', left(v_message ->> 'idempotencyKey', 200),
      'payloadSha256', encode(
        extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
        'hex'
      ),
      'readCount', v_read_count,
      'errorCode', p_error_code,
      'deadLetteredAt', clock_timestamp()
    )
  );

  perform pgmq.delete('background_jobs', p_msg_id);
  return true;
end;
$$;

create or replace function public.purge_background_job_dead_letters(
  p_before timestamptz,
  p_limit integer default 500
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_ids bigint[];
  v_deleted_count bigint;
begin
  if p_before is null then
    raise exception using
      errcode = '22023',
      message = 'dead-letter retention cutoff is required';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode = '22023',
      message = 'dead-letter purge limit is out of range';
  end if;

  with candidates as (
    select queued.msg_id
    from pgmq.q_background_jobs_dead_letter as queued
    where queued.enqueued_at < p_before
    order by queued.enqueued_at, queued.msg_id
    limit p_limit
    for update skip locked
  )
  select coalesce(array_agg(candidates.msg_id), array[]::bigint[])
  into v_message_ids
  from candidates;

  if cardinality(v_message_ids) = 0 then
    return 0;
  end if;

  select count(*)
  into v_deleted_count
  from pgmq.delete('background_jobs_dead_letter', v_message_ids);

  return v_deleted_count;
end;
$$;

revoke all on function public.enqueue_background_job(jsonb, integer) from public, anon, authenticated;
revoke all on function public.read_background_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.delete_background_job(bigint) from public, anon, authenticated;
revoke all on function public.extend_background_job_visibility(bigint, integer) from public, anon, authenticated;
revoke all on function public.dead_letter_background_job(bigint, text) from public, anon, authenticated;
revoke all on function public.purge_background_job_dead_letters(timestamptz, integer) from public, anon, authenticated;

grant execute on function public.enqueue_background_job(jsonb, integer) to service_role;
grant execute on function public.read_background_jobs(integer, integer) to service_role;
grant execute on function public.delete_background_job(bigint) to service_role;
grant execute on function public.extend_background_job_visibility(bigint, integer) to service_role;
grant execute on function public.dead_letter_background_job(bigint, text) to service_role;
grant execute on function public.purge_background_job_dead_letters(timestamptz, integer) to service_role;
