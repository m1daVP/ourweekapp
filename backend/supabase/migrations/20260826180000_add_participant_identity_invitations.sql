alter table public.participants
  add column email text,
  add column email_normalized text,
  add column user_id uuid references public.users(id) on delete set null,
  add constraint participants_email_normalized_check
    check (
      email_normalized is null
      or (email is not null and email_normalized = lower(btrim(email)))
    );

create unique index participants_workspace_email_normalized_unique_idx
  on public.participants (workspace_id, email_normalized)
  where deleted_at is null and is_active and email_normalized is not null;

create index participants_user_id_idx
  on public.participants (user_id)
  where user_id is not null;

alter table public.workspace_invitations
  add column participant_id uuid,
  add column delivery_status text not null default 'pending',
  add column delivery_attempted_at timestamptz,
  add column delivery_sent_at timestamptz,
  add constraint workspace_invitations_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed')),
  add constraint workspace_invitations_participant_fk
    foreign key (workspace_id, participant_id)
    references public.participants(workspace_id, id);

create index workspace_invitations_participant_id_idx
  on public.workspace_invitations (workspace_id, participant_id)
  where participant_id is not null;

create or replace function public.create_participant_invitation(
  p_workspace_id uuid,
  p_participant_id uuid,
  p_email text,
  p_email_normalized text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns public.workspace_invitations
language plpgsql
as $$
declare
  v_participant public.participants%rowtype;
  v_invitation public.workspace_invitations%rowtype;
  v_derived_role text;
begin
  select * into v_participant
  from public.participants
  where id = p_participant_id
    and workspace_id = p_workspace_id
    and deleted_at is null
    and is_active
  for update;

  if not found then
    raise exception 'participant_not_found';
  end if;

  if p_email is null
    or p_email_normalized is null
    or btrim(p_email) = ''
    or p_email_normalized <> lower(btrim(p_email)) then
    raise exception 'participant_email_required';
  end if;

  if btrim(p_token_hash) = '' or p_expires_at <= now() then
    raise exception 'invitation_invalid_or_expired';
  end if;

  v_derived_role := case v_participant.type
    when 'adult' then 'adult_member'
    when 'child' then 'viewer'
    when 'other' then 'viewer'
    else null
  end;

  if v_derived_role is null or p_role <> v_derived_role then
    raise exception 'participant_role_invalid';
  end if;

  perform 1
  from public.participants
  where workspace_id = p_workspace_id
    and id <> p_participant_id
    and deleted_at is null
    and is_active
    and email_normalized = p_email_normalized
  for update;

  if found then
    raise exception 'participant_email_already_linked';
  end if;

  perform 1
  from public.workspace_invitations
  where workspace_id = p_workspace_id
    and participant_id = p_participant_id
    and status = 'pending'
  for update;

  if found then
    raise exception 'participant_email_already_linked';
  end if;

  update public.participants
  set email = btrim(p_email),
      email_normalized = p_email_normalized
  where id = p_participant_id
    and workspace_id = p_workspace_id;

  insert into public.workspace_invitations (
    workspace_id,
    participant_id,
    email,
    email_normalized,
    display_name,
    role,
    token_hash,
    status,
    expires_at
  ) values (
    p_workspace_id,
    p_participant_id,
    btrim(p_email),
    p_email_normalized,
    v_participant.name,
    v_derived_role,
    p_token_hash,
    'pending',
    p_expires_at
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

create or replace function public.accept_participant_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email_normalized text,
  p_now timestamptz
)
returns public.workspace_members
language plpgsql
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
  v_participant public.participants%rowtype;
  v_member public.workspace_members%rowtype;
begin
  select * into v_invitation
  from public.workspace_invitations
  where token_hash = p_token_hash
    and status = 'pending'
  for update;

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if v_invitation.expires_at <= p_now then
    update public.workspace_invitations
    set status = 'expired'
    where id = v_invitation.id;
    raise exception 'invitation_invalid_or_expired';
  end if;

  if v_invitation.email_normalized <> p_email_normalized then
    raise exception 'invitation_email_mismatch';
  end if;

  if v_invitation.participant_id is null then
    raise exception 'invitation_invalid_or_expired';
  end if;

  select * into v_participant
  from public.participants
  where id = v_invitation.participant_id
    and workspace_id = v_invitation.workspace_id
    and deleted_at is null
    and is_active
  for update;

  if not found then
    raise exception 'participant_not_found';
  end if;

  if v_participant.email_normalized <> v_invitation.email_normalized
    or (v_participant.user_id is not null and v_participant.user_id <> p_user_id) then
    raise exception 'workspace_member_already_linked';
  end if;

  perform 1
  from public.participants
  where workspace_id = v_invitation.workspace_id
    and id <> v_participant.id
    and deleted_at is null
    and is_active
    and user_id = p_user_id
  for update;

  if found then
    raise exception 'workspace_member_already_linked';
  end if;

  select * into v_member
  from public.workspace_members
  where workspace_id = v_invitation.workspace_id
    and user_id = p_user_id
  for update;

  if found and v_member.status = 'active' then
    raise exception 'workspace_member_already_linked';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    display_name,
    email,
    role,
    status
  ) values (
    v_invitation.workspace_id,
    p_user_id,
    v_participant.name,
    v_invitation.email,
    v_invitation.role,
    'active'
  )
  on conflict (workspace_id, user_id) do update
  set display_name = excluded.display_name,
      email = excluded.email,
      role = excluded.role,
      status = 'active'
  returning * into v_member;

  update public.participants
  set user_id = p_user_id
  where id = v_participant.id
    and workspace_id = v_invitation.workspace_id;

  update public.workspace_invitations
  set status = 'accepted'
  where id = v_invitation.id;

  return v_member;
end;
$$;

create or replace function public.link_existing_workspace_member_to_participant(
  p_workspace_id uuid,
  p_participant_id uuid,
  p_email text,
  p_email_normalized text
)
returns public.workspace_members
language plpgsql
as $$
declare
  v_participant public.participants%rowtype;
  v_member public.workspace_members%rowtype;
begin
  if p_email is null
    or p_email_normalized is null
    or btrim(p_email) = ''
    or p_email_normalized <> lower(btrim(p_email)) then
    raise exception 'participant_email_required';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
    and workspace_id = p_workspace_id
    and deleted_at is null
    and is_active
  for update;

  if not found then
    raise exception 'participant_not_found';
  end if;

  select * into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id
    and status = 'active'
    and email is not null
    and lower(btrim(email)) = p_email_normalized
  for update;

  if not found then
    raise exception 'workspace_member_not_found';
  end if;

  if (v_participant.email_normalized is not null
      and v_participant.email_normalized <> p_email_normalized)
    or (v_participant.user_id is not null
      and v_participant.user_id <> v_member.user_id) then
    raise exception 'workspace_member_already_linked';
  end if;

  perform 1
  from public.participants
  where workspace_id = p_workspace_id
    and id <> p_participant_id
    and deleted_at is null
    and is_active
    and email_normalized = p_email_normalized
  for update;

  if found then
    raise exception 'participant_email_already_linked';
  end if;

  perform 1
  from public.participants
  where workspace_id = p_workspace_id
    and id <> p_participant_id
    and deleted_at is null
    and is_active
    and user_id = v_member.user_id
  for update;

  if found then
    raise exception 'workspace_member_already_linked';
  end if;

  update public.participants
  set email = btrim(p_email),
      email_normalized = p_email_normalized,
      user_id = v_member.user_id
  where id = p_participant_id
    and workspace_id = p_workspace_id;

  update public.workspace_invitations
  set status = 'revoked'
  where workspace_id = p_workspace_id
    and participant_id = p_participant_id
    and email_normalized = p_email_normalized
    and status = 'pending';

  return v_member;
end;
$$;

create or replace function public.revoke_participant_invitation(
  p_workspace_id uuid,
  p_invitation_id uuid
)
returns public.workspace_invitations
language plpgsql
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
begin
  select * into v_invitation
  from public.workspace_invitations
  where id = p_invitation_id
    and workspace_id = p_workspace_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  update public.workspace_invitations
  set status = 'revoked'
  where id = v_invitation.id
  returning * into v_invitation;

  if v_invitation.participant_id is not null then
    update public.participants
    set email = null,
        email_normalized = null,
        user_id = null
    where id = v_invitation.participant_id
      and workspace_id = p_workspace_id
      and user_id is null
      and email_normalized = v_invitation.email_normalized;
  end if;

  return v_invitation;
end;
$$;
