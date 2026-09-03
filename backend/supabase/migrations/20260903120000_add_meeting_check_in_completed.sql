alter table public.meetings
  add column check_in_completed boolean not null default false;
