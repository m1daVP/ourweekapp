create or replace function public.account_delete(
  p_user_id uuid,
  p_deleted_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_record record;
  current_workspace public.workspaces%rowtype;
  replacement_owner_id uuid;
begin
  update public.sessions
     set revoked_at = coalesce(revoked_at, p_deleted_at)
   where user_id = p_user_id
     and revoked_at is null;

  update public.calendar_connections
     set access_token_encrypted = null,
         refresh_token_encrypted = null,
         token_expires_at = null,
         state = 'disconnected',
         disconnected_at = coalesce(disconnected_at, p_deleted_at)
   where user_id = p_user_id
     and (
       access_token_encrypted is not null
       or refresh_token_encrypted is not null
       or token_expires_at is not null
       or state <> 'disconnected'
       or disconnected_at is null
     );

  for membership_record in
    select wm.workspace_id
      from public.workspace_members wm
     where wm.user_id = p_user_id
       and wm.status = 'active'
     order by wm.created_at asc
     for update
  loop
    select *
      into current_workspace
      from public.workspaces
     where id = membership_record.workspace_id
       and deleted_at is null
     for update;

    if not found then
      update public.workspace_members
         set status = 'removed'
       where workspace_id = membership_record.workspace_id
         and user_id = p_user_id
         and status = 'active';
      continue;
    end if;

    perform 1
      from public.workspace_members
     where workspace_id = membership_record.workspace_id
       and status = 'active'
     for update;

    if current_workspace.owner_id = p_user_id then
      replacement_owner_id := null;

      select wm.user_id
        into replacement_owner_id
        from public.workspace_members wm
       where wm.workspace_id = membership_record.workspace_id
         and wm.user_id <> p_user_id
         and wm.status = 'active'
         and wm.role in ('owner', 'adult_member')
       order by
         case when wm.role = 'owner' then 0 else 1 end,
         wm.created_at asc
       limit 1;

      if replacement_owner_id is not null then
        update public.workspace_members
           set role = 'owner'
         where workspace_id = membership_record.workspace_id
           and user_id = replacement_owner_id
           and status = 'active'
           and role <> 'owner';

        update public.workspaces
           set owner_id = replacement_owner_id
         where id = membership_record.workspace_id
           and owner_id = p_user_id
           and deleted_at is null;
      else
        update public.workspaces
           set deleted_at = coalesce(deleted_at, p_deleted_at)
         where id = membership_record.workspace_id
           and deleted_at is null;
      end if;
    end if;

    update public.workspace_members
       set status = 'removed'
     where workspace_id = membership_record.workspace_id
       and user_id = p_user_id
       and status = 'active';
  end loop;

  update public.users
     set deleted_at = coalesce(deleted_at, p_deleted_at)
   where id = p_user_id
     and deleted_at is null;
end;
$$;

revoke all on function public.account_delete(uuid, timestamptz) from public;
grant execute on function public.account_delete(uuid, timestamptz) to service_role;

