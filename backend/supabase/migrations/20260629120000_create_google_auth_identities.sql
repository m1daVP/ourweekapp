alter table public.users
  alter column password_hash drop not null;

create table public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  email text not null,
  email_normalized text not null,
  email_verified boolean not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_identities_provider_check check (provider in ('google')),
  constraint auth_identities_provider_subject_not_blank check (btrim(provider_subject) <> ''),
  constraint auth_identities_email_normalized_check check (email_normalized = lower(btrim(email))),
  constraint auth_identities_email_not_blank check (btrim(email) <> ''),
  constraint auth_identities_email_normalized_not_blank check (btrim(email_normalized) <> ''),
  constraint auth_identities_provider_subject_unique unique (provider, provider_subject)
);

create trigger auth_identities_set_updated_at
before update on public.auth_identities
for each row execute function public.set_updated_at();

create index auth_identities_user_id_idx on public.auth_identities (user_id);
create index auth_identities_email_normalized_idx on public.auth_identities (email_normalized);
