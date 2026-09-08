create or replace function public.confirm_password_reset(
  p_code_hash text,
  p_password_hash text,
  p_confirmed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.password_reset_tokens%rowtype;
begin
  if p_code_hash is null
    or pg_catalog.btrim(p_code_hash) = ''
    or p_password_hash is null
    or pg_catalog.btrim(p_password_hash) = ''
    or p_confirmed_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_password_reset_input';
  end if;

  select *
  into v_token
  from public.password_reset_tokens
  where code_hash = p_code_hash
    and consumed_at is null
    and expires_at > p_confirmed_at
  for update;

  if not found then
    return false;
  end if;

  update public.password_reset_tokens
  set consumed_at = p_confirmed_at
  where id = v_token.id;

  update public.users
  set password_hash = p_password_hash
  where id = v_token.user_id
    and deleted_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'password_reset_user_not_found';
  end if;

  update public.sessions
  set revoked_at = p_confirmed_at
  where user_id = v_token.user_id
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function public.confirm_password_reset(text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.confirm_password_reset(text, text, timestamptz)
to service_role;
