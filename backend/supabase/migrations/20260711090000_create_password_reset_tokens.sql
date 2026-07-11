create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint password_reset_tokens_code_hash_unique unique (code_hash),
  constraint password_reset_tokens_code_hash_not_blank check (btrim(code_hash) <> '')
);

create trigger password_reset_tokens_set_updated_at
before update on public.password_reset_tokens
for each row execute function public.set_updated_at();

create index password_reset_tokens_user_id_idx on public.password_reset_tokens (user_id);

-- Deny-all posture: the API uses the service-role key which bypasses RLS,
-- and default privileges already revoke grants for anon/authenticated.
alter table public.password_reset_tokens enable row level security;
