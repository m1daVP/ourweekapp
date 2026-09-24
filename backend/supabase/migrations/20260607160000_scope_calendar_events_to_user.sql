alter table public.calendar_events
  add column if not exists user_id uuid references public.users(id) on delete cascade;

update public.calendar_events ce
set user_id = (
  select cc.user_id
  from public.calendar_connections cc
  where cc.workspace_id = ce.workspace_id
    and cc.provider = ce.provider
  order by cc.updated_at desc, cc.created_at desc
  limit 1
)
where ce.user_id is null;

delete from public.calendar_events
where user_id is null;

with ranked_calendar_events as (
  select
    id,
    row_number() over (
      partition by workspace_id, user_id, provider, source_type, source_id
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.calendar_events
)
delete from public.calendar_events ce
using ranked_calendar_events ranked
where ce.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table public.calendar_events
  alter column user_id set not null;

create index if not exists calendar_events_workspace_user_idx
  on public.calendar_events (workspace_id, user_id);

create unique index if not exists calendar_events_workspace_user_provider_source_unique_idx
  on public.calendar_events (workspace_id, user_id, provider, source_type, source_id);
