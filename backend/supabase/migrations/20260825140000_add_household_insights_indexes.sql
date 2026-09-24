create index insights_completed_meetings_workspace_completed_idx
  on public.meetings (workspace_id, completed_at desc)
  where deleted_at is null and status = 'completed';

create index insights_active_tasks_workspace_created_idx
  on public.tasks (workspace_id, created_at desc)
  where deleted_at is null;

create index insights_active_agreements_workspace_created_idx
  on public.agreements (workspace_id, created_at desc)
  where deleted_at is null;
