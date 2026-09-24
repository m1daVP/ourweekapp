create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  display_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_unique unique (email),
  constraint users_email_normalized_unique unique (email_normalized),
  constraint users_email_normalized_check check (email_normalized = lower(btrim(email))),
  constraint users_email_not_blank check (btrim(email) <> ''),
  constraint users_email_normalized_not_blank check (btrim(email_normalized) <> '')
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token_hash text not null,
  device_label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint sessions_refresh_token_hash_unique unique (refresh_token_hash),
  constraint sessions_refresh_token_hash_not_blank check (btrim(refresh_token_hash) <> '')
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create index users_email_normalized_idx on public.users (email_normalized);
create index users_updated_at_idx on public.users (updated_at);
create index users_not_deleted_idx on public.users (id) where deleted_at is null;

create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_user_active_idx on public.sessions (user_id, expires_at) where revoked_at is null;
create index sessions_refresh_token_hash_idx on public.sessions (refresh_token_hash);