create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workspaces_name_not_blank check (btrim(name) <> '')
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  email text,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_display_name_not_blank check (btrim(display_name) <> ''),
  constraint workspace_members_role_check check (role in ('owner', 'adult_member', 'viewer')),
  constraint workspace_members_status_check check (status in ('active', 'invited', 'removed'))
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  display_name text,
  role text not null,
  token_hash text not null,
  status text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint workspace_invitations_email_normalized_check check (email_normalized = lower(btrim(email))),
  constraint workspace_invitations_email_not_blank check (btrim(email) <> ''),
  constraint workspace_invitations_role_check check (role in ('owner', 'adult_member', 'viewer')),
  constraint workspace_invitations_status_check check (status in ('pending', 'accepted', 'expired', 'revoked')),
  constraint workspace_invitations_token_hash_not_blank check (btrim(token_hash) <> '')
);

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspaces_updated_at_idx on public.workspaces (updated_at);
create index workspaces_not_deleted_idx on public.workspaces (id) where deleted_at is null;

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_status_idx on public.workspace_members (workspace_id, status);
create index workspace_members_updated_at_idx on public.workspace_members (updated_at);

create index workspace_invitations_workspace_id_idx on public.workspace_invitations (workspace_id);
create index workspace_invitations_email_normalized_idx on public.workspace_invitations (email_normalized);
create unique index workspace_invitations_pending_email_unique_idx
  on public.workspace_invitations (workspace_id, email_normalized)
  where status = 'pending';