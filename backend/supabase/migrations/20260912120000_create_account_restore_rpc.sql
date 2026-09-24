create or replace function public.account_restore(
  p_user_id uuid
)
returns table(
  restored_workspace_count integer,
  restored_membership_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user public.users%rowtype;
  workspace_record record;
begin
  select *
    into target_user
    from public.users
   where id = p_user_id
   for update;

  if not found or target_user.deleted_at is null then
    raise exception using
      errcode = 'P0002',
      message = 'deleted_account_not_found';
  end if;

  update public.users
     set deleted_at = null
   where id = p_user_id
     and deleted_at is not null;

  restored_workspace_count := 0;
  restored_membership_count := 0;

  for workspace_record in
    select w.id, w.owner_id, w.deleted_at
      from public.workspaces w
      join public.workspace_members wm
        on wm.workspace_id = w.id
     where wm.user_id = p_user_id
       and wm.status = 'removed'
     for update of w, wm
  loop
    if workspace_record.deleted_at is not null
       and workspace_record.owner_id = p_user_id then
      update public.workspaces
         set deleted_at = null
       where id = workspace_record.id
         and deleted_at is not null;

      restored_workspace_count := restored_workspace_count + 1;
    end if;

    if workspace_record.deleted_at is null
       or workspace_record.owner_id = p_user_id then
      update public.workspace_members
         set status = 'active',
             role = case
               when workspace_record.owner_id = p_user_id then 'owner'
               else 'adult_member'
             end
       where workspace_id = workspace_record.id
         and user_id = p_user_id
         and status = 'removed';

      restored_membership_count := restored_membership_count + 1;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.account_restore(uuid) from public;
grant execute on function public.account_restore(uuid) to service_role;
