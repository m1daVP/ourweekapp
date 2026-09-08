do $$
begin
  if exists (
    select 1
    from public.auth_identities
    group by provider, user_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'duplicate_auth_identities_for_user';
  end if;
end;
$$;

alter table public.auth_identities
  add constraint auth_identities_provider_user_unique
  unique (provider, user_id);

create or replace function public.link_google_auth_identity(
  p_user_id uuid,
  p_provider_subject text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.auth_identities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_subject_identity public.auth_identities%rowtype;
  v_user_identity public.auth_identities%rowtype;
  v_identity public.auth_identities%rowtype;
  v_subject text := btrim(p_provider_subject);
  v_email text := lower(btrim(p_email));
begin
  if v_subject is null or v_subject = '' or v_email is null or v_email = '' then
    raise exception using
      errcode = '22023',
      message = 'invalid_google_identity';
  end if;

  select *
  into v_user
  from public.users
  where id = p_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'auth_user_not_found';
  end if;

  if v_user.email_normalized <> v_email then
    raise exception using
      errcode = 'P0001',
      message = 'account_link_email_mismatch';
  end if;

  select *
  into v_subject_identity
  from public.auth_identities
  where provider = 'google'
    and provider_subject = v_subject;

  if found then
    if v_subject_identity.user_id = p_user_id then
      return v_subject_identity;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'account_link_conflict';
  end if;

  select *
  into v_user_identity
  from public.auth_identities
  where provider = 'google'
    and user_id = p_user_id;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'google_already_linked';
  end if;

  begin
    insert into public.auth_identities (
      user_id,
      provider,
      provider_subject,
      email,
      email_normalized,
      email_verified,
      display_name,
      avatar_url
    ) values (
      p_user_id,
      'google',
      v_subject,
      v_email,
      v_email,
      true,
      nullif(btrim(p_display_name), ''),
      nullif(btrim(p_avatar_url), '')
    )
    returning * into v_identity;
  exception
    when unique_violation then
      select *
      into v_subject_identity
      from public.auth_identities
      where provider = 'google'
        and provider_subject = v_subject;

      if found then
        if v_subject_identity.user_id = p_user_id then
          return v_subject_identity;
        end if;

        raise exception using
          errcode = 'P0001',
          message = 'account_link_conflict';
      end if;

      select *
      into v_user_identity
      from public.auth_identities
      where provider = 'google'
        and user_id = p_user_id;

      if found then
        raise exception using
          errcode = 'P0001',
          message = 'google_already_linked';
      end if;

      raise;
  end;

  return v_identity;
end;
$$;

revoke all on function public.link_google_auth_identity(uuid, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.link_google_auth_identity(uuid, text, text, text, text)
to service_role;
