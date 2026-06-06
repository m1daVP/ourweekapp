create or replace function public.workspace_update_active_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text default null,
  p_status text default null
)
returns table (
  workspace_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_workspace public.workspaces%rowtype;
  current_member public.workspace_members%rowtype;
  replacement_owner_id uuid;
  next_role text;
  next_status text;
begin
  if p_role is not null and p_role not in ('owner', 'adult_member', 'viewer') then
    raise exception 'workspace_member_role_invalid' using errcode = '22023';
  end if;

  if p_status is not null and p_status <> 'removed' then
    raise exception 'workspace_member_status_transition_invalid' using errcode = '22023';
  end if;

  select *
    into current_workspace
    from public.workspaces
   where id = p_workspace_id
     and deleted_at is null
   for update;

  if not found then
    return;
  end if;

  perform 1
    from public.workspace_members
   where workspace_id = p_workspace_id
     and status = 'active'
   for update;

  select *
    into current_member
    from public.workspace_members
   where workspace_id = p_workspace_id
     and user_id = p_user_id
     and status = 'active';

  if not found then
    return;
  end if;

  next_role := coalesce(p_role, current_member.role);
  next_status := coalesce(p_status, current_member.status);

  if current_member.role = 'owner'
     and (next_role <> 'owner' or next_status <> 'active') then
    select wm.user_id
      into replacement_owner_id
      from public.workspace_members wm
     where wm.workspace_id = p_workspace_id
       and wm.user_id <> p_user_id
       and wm.role = 'owner'
       and wm.status = 'active'
     order by wm.created_at asc
     limit 1;

    if replacement_owner_id is null then
      raise exception 'workspace_last_owner' using errcode = 'P0001';
    end if;

    if current_workspace.owner_id = p_user_id then
      update public.workspaces
         set owner_id = replacement_owner_id
       where id = p_workspace_id
         and owner_id = p_user_id;
    end if;
  end if;

  return query
    update public.workspace_members wm
       set role = next_role,
           status = next_status
     where wm.workspace_id = p_workspace_id
       and wm.user_id = p_user_id
       and wm.status = 'active'
     returning wm.workspace_id,
               wm.user_id,
               wm.display_name,
               wm.email,
               wm.role,
               wm.status,
               wm.created_at,
               wm.updated_at;
end;
$$;

revoke all on function public.workspace_update_active_member(uuid, uuid, text, text) from public;
grant execute on function public.workspace_update_active_member(uuid, uuid, text, text) to service_role;
