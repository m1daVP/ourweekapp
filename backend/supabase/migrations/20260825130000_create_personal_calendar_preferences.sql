create table public.calendar_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google',
  weekly_meeting_sync_enabled boolean not null default false,
  assigned_task_sync_enabled boolean not null default false,
  weekly_meeting_day text not null default 'sunday',
  weekly_meeting_time time not null default '18:00:00',
  time_zone text not null default 'UTC',
  last_sync_error_code text,
  last_sync_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_preferences_provider_check check (provider = 'google'),
  constraint calendar_preferences_weekday_check check (
    weekly_meeting_day in (
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    )
  ),
  constraint calendar_preferences_error_check check (
    last_sync_error_code is null or last_sync_error_code = 'provider-error'
  ),
  constraint calendar_preferences_workspace_user_provider_unique
    unique (workspace_id, user_id, provider)
);

create trigger calendar_preferences_set_updated_at
before update on public.calendar_preferences
for each row execute function public.set_updated_at();

create index calendar_preferences_workspace_user_idx
  on public.calendar_preferences (workspace_id, user_id);

alter table public.calendar_preferences enable row level security;

alter table public.tasks
  add column if not exists responsible_user_ids jsonb not null default '[]'::jsonb;

alter table public.tasks
  add constraint tasks_responsible_user_ids_array
  check (jsonb_typeof(responsible_user_ids) = 'array');

alter table public.calendar_events
  drop constraint if exists calendar_events_source_type_check;

alter table public.calendar_events
  add constraint calendar_events_source_type_check
  check (source_type in (
    'meeting_reminder',
    'task_due_date',
    'follow_up_date',
    'weekly_meeting'
  ));
