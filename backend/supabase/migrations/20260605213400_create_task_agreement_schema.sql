create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  responsibility_type text not null,
  responsible_participant_ids jsonb not null,
  due_date date,
  status text not null,
  source_meeting_id uuid,
  server_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tasks_workspace_id_id_unique unique (workspace_id, id),
  constraint tasks_source_meeting_fk foreign key (workspace_id, source_meeting_id) references public.meetings(workspace_id, id) on delete restrict,
  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_responsibility_type_check check (responsibility_type in ('participant', 'shared', 'needsDiscussion')),
  constraint tasks_responsible_participant_ids_array check (jsonb_typeof(responsible_participant_ids) = 'array'),
  constraint tasks_status_check check (status in ('open', 'done', 'skipped')),
  constraint tasks_server_revision_positive check (server_revision > 0)
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  participant_ids jsonb not null,
  related_task_ids jsonb,
  source_meeting_id uuid not null,
  server_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint agreements_workspace_id_id_unique unique (workspace_id, id),
  constraint agreements_source_meeting_fk foreign key (workspace_id, source_meeting_id) references public.meetings(workspace_id, id) on delete restrict,
  constraint agreements_title_not_blank check (btrim(title) <> ''),
  constraint agreements_participant_ids_array check (jsonb_typeof(participant_ids) = 'array'),
  constraint agreements_related_task_ids_array check (related_task_ids is null or jsonb_typeof(related_task_ids) = 'array'),
  constraint agreements_server_revision_positive check (server_revision > 0)
);

create table public.task_review_decisions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid not null,
  source_meeting_id uuid not null,
  decided_at timestamptz not null default now(),
  primary key (workspace_id, meeting_id, source_meeting_id),
  constraint task_review_decisions_meeting_fk foreign key (workspace_id, meeting_id) references public.meetings(workspace_id, id) on delete cascade,
  constraint task_review_decisions_source_meeting_fk foreign key (workspace_id, source_meeting_id) references public.meetings(workspace_id, id) on delete cascade
);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger agreements_set_updated_at
before update on public.agreements
for each row execute function public.set_updated_at();

create index tasks_workspace_id_idx on public.tasks (workspace_id);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status);
create index tasks_workspace_source_meeting_idx on public.tasks (workspace_id, source_meeting_id);
create index tasks_workspace_updated_at_idx on public.tasks (workspace_id, updated_at);
create index tasks_updated_at_idx on public.tasks (updated_at);
create index tasks_not_deleted_idx on public.tasks (workspace_id, id) where deleted_at is null;

create index agreements_workspace_id_idx on public.agreements (workspace_id);
create index agreements_workspace_source_meeting_idx on public.agreements (workspace_id, source_meeting_id);
create index agreements_workspace_updated_at_idx on public.agreements (workspace_id, updated_at);
create index agreements_updated_at_idx on public.agreements (updated_at);
create index agreements_not_deleted_idx on public.agreements (workspace_id, id) where deleted_at is null;

create index task_review_decisions_workspace_decided_at_idx on public.task_review_decisions (workspace_id, decided_at);