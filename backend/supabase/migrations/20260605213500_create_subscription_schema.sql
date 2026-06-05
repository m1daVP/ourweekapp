create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_entitlement_id text,
  plan_type text not null,
  status text not null,
  expires_at timestamptz,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_check check (provider in ('google_play', 'app_store', 'revenuecat')),
  constraint subscriptions_plan_type_check check (plan_type in ('free', 'premium')),
  constraint subscriptions_status_not_blank check (btrim(status) <> '')
);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create index subscriptions_workspace_id_idx on public.subscriptions (workspace_id);
create index subscriptions_workspace_plan_idx on public.subscriptions (workspace_id, plan_type, status);
create index subscriptions_updated_at_idx on public.subscriptions (updated_at);