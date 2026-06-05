create table public.participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  initials text not null,
  avatar_color text not null,
  type text not null,
  is_active boolean not null default true,
  server_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint participants_workspace_id_id_unique unique (workspace_id, id),
  constraint participants_name_not_blank check (btrim(name) <> ''),
  constraint participants_initials_not_blank check (btrim(initials) <> ''),
  constraint participants_avatar_color_not_blank check (btrim(avatar_color) <> ''),
  constraint participants_type_check check (type in ('adult', 'child', 'other')),
  constraint participants_server_revision_positive check (server_revision > 0)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text not null,
  title text not null,
  status text not null,
  participant_ids jsonb not null,
  sections jsonb not null,
  current_section_index integer not null default 0,
  ai_summary jsonb,
  server_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint meetings_workspace_id_id_unique unique (workspace_id, id),
  constraint meetings_template_id_not_blank check (btrim(template_id) <> ''),
  constraint meetings_title_not_blank check (btrim(title) <> ''),
  constraint meetings_status_check check (status in ('draft', 'in_progress', 'paused', 'incomplete', 'completed')),
  constraint meetings_participant_ids_array check (jsonb_typeof(participant_ids) = 'array'),
  constraint meetings_sections_array check (jsonb_typeof(sections) = 'array'),
  constraint meetings_current_section_index_nonnegative check (current_section_index >= 0),
  constraint meetings_server_revision_positive check (server_revision > 0)
);

create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create index participants_workspace_id_idx on public.participants (workspace_id);
create index participants_workspace_updated_at_idx on public.participants (workspace_id, updated_at);
create index participants_updated_at_idx on public.participants (updated_at);
create index participants_not_deleted_idx on public.participants (workspace_id, id) where deleted_at is null;

create index meetings_workspace_id_idx on public.meetings (workspace_id);
create index meetings_workspace_status_idx on public.meetings (workspace_id, status);
create index meetings_workspace_completed_at_idx on public.meetings (workspace_id, completed_at desc);
create index meetings_workspace_updated_at_idx on public.meetings (workspace_id, updated_at);
create index meetings_updated_at_idx on public.meetings (updated_at);
create index meetings_not_deleted_idx on public.meetings (workspace_id, id) where deleted_at is null;