create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  connected_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disconnected_at timestamptz,
  constraint calendar_connections_provider_check check (provider = 'google'),
  constraint calendar_connections_state_check check (state in ('disconnected', 'connected', 'setup_required'))
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  source_type text not null,
  source_id text not null,
  provider_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_provider_check check (provider = 'google'),
  constraint calendar_events_source_type_check check (source_type in ('meeting_reminder', 'task_due_date', 'follow_up_date')),
  constraint calendar_events_source_id_not_blank check (btrim(source_id) <> ''),
  constraint calendar_events_provider_event_id_not_blank check (btrim(provider_event_id) <> '')
);

create trigger calendar_connections_set_updated_at
before update on public.calendar_connections
for each row execute function public.set_updated_at();

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create index calendar_connections_workspace_id_idx on public.calendar_connections (workspace_id);
create index calendar_connections_workspace_user_idx on public.calendar_connections (workspace_id, user_id);
create index calendar_connections_updated_at_idx on public.calendar_connections (updated_at);
create unique index calendar_connections_workspace_user_provider_unique_idx
  on public.calendar_connections (workspace_id, user_id, provider);

create index calendar_events_workspace_id_idx on public.calendar_events (workspace_id);
create index calendar_events_workspace_source_idx on public.calendar_events (workspace_id, source_type, source_id);
create index calendar_events_provider_event_idx on public.calendar_events (provider, provider_event_id);
create index calendar_events_updated_at_idx on public.calendar_events (updated_at);