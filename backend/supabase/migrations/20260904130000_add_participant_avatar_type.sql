alter table public.participants
  add column avatar_type text;

alter table public.participants
  add constraint participants_avatar_type_check
  check (
    avatar_type is null or avatar_type ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );
