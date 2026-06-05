create table public.ai_summary_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  meeting_id uuid not null,
  provider text not null,
  status text not null,
  input_hash text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  constraint ai_summary_requests_meeting_fk foreign key (workspace_id, meeting_id) references public.meetings(workspace_id, id) on delete cascade,
  constraint ai_summary_requests_provider_not_blank check (btrim(provider) <> ''),
  constraint ai_summary_requests_status_not_blank check (btrim(status) <> '')
);

create index ai_summary_requests_workspace_id_idx on public.ai_summary_requests (workspace_id);
create index ai_summary_requests_workspace_created_at_idx on public.ai_summary_requests (workspace_id, created_at);
create index ai_summary_requests_user_created_at_idx on public.ai_summary_requests (user_id, created_at);
create index ai_summary_requests_meeting_id_idx on public.ai_summary_requests (meeting_id);