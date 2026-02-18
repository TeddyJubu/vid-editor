-- Initial core schema for the AI video editor app

create extension if not exists "pgcrypto";

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Workspace access helpers for RLS
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- Tables

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint memberships_user_workspace_unique unique (user_id, workspace_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  format_preset text not null,
  current_version_id uuid null,
  thumbnail_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_json jsonb not null,
  label text null,
  created_at timestamptz not null default now()
);

alter table public.projects
  add constraint projects_current_version_id_fkey
  foreign key (current_version_id)
  references public.project_versions(id)
  on delete set null;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  filename text not null,
  storage_key text not null,
  mime_type text not null,
  size_bytes bigint not null,
  duration_seconds double precision null,
  width integer null,
  height integer null,
  thumbnail_key text null,
  created_at timestamptz not null default now(),
  constraint assets_storage_key_unique unique (storage_key)
);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_version_id uuid not null references public.project_versions(id) on delete cascade,
  tier text not null,
  duration_seconds double precision not null,
  width integer not null,
  height integer not null,
  fps double precision not null,
  estimated_ru bigint not null,
  actual_ru bigint null,
  status text not null,
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.render_outputs (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.render_jobs(id) on delete cascade,
  storage_key text not null,
  format text not null,
  size_bytes bigint not null,
  share_token text not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint render_outputs_share_token_unique unique (share_token)
);

create table if not exists public.credit_ledgers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  balance_ru bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint credit_ledgers_workspace_unique unique (workspace_id)
);

create trigger set_credit_ledgers_updated_at
before update on public.credit_ledgers
for each row execute function public.set_updated_at();

create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  credit_ledger_id uuid not null references public.credit_ledgers(id) on delete cascade,
  type text not null,
  delta_ru bigint not null,
  render_job_id uuid null references public.render_jobs(id) on delete set null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  stripe_price_id text not null,
  status text not null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_workspace_unique unique (workspace_id)
);

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_memberships_workspace_id on public.memberships(workspace_id);
create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_project_versions_project_id on public.project_versions(project_id);
create index if not exists idx_assets_workspace_id on public.assets(workspace_id);
create index if not exists idx_assets_project_id on public.assets(project_id);
create index if not exists idx_render_jobs_workspace_id on public.render_jobs(workspace_id);
create index if not exists idx_render_jobs_project_version_id on public.render_jobs(project_version_id);
create index if not exists idx_render_outputs_render_job_id on public.render_outputs(render_job_id);
create index if not exists idx_credit_events_credit_ledger_id on public.credit_events(credit_ledger_id);
create index if not exists idx_subscriptions_workspace_id on public.subscriptions(workspace_id);

-- RLS
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.assets enable row level security;
alter table public.render_jobs enable row level security;
alter table public.render_outputs enable row level security;
alter table public.credit_ledgers enable row level security;
alter table public.credit_events enable row level security;
alter table public.subscriptions enable row level security;

-- workspaces
create policy "workspaces_select_member" on public.workspaces
for select
using (public.is_workspace_member(id));

create policy "workspaces_insert_authenticated" on public.workspaces
for insert
with check (auth.role() = 'authenticated');

create policy "workspaces_update_member" on public.workspaces
for update
using (public.is_workspace_member(id))
with check (public.is_workspace_member(id));

create policy "workspaces_delete_member" on public.workspaces
for delete
using (public.is_workspace_member(id));

-- memberships
create policy "memberships_select_member" on public.memberships
for select
using (public.is_workspace_member(workspace_id));

-- Allow a user to create the *first* membership for a workspace (bootstrapping),
-- otherwise only owners can add members.
create policy "memberships_insert_bootstrap_or_owner" on public.memberships
for insert
with check (
  user_id = auth.uid()
  and (
    not exists (
      select 1 from public.memberships m2
      where m2.workspace_id = memberships.workspace_id
    )
    or public.is_workspace_owner(workspace_id)
  )
);

create policy "memberships_update_owner" on public.memberships
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "memberships_delete_owner" on public.memberships
for delete
using (public.is_workspace_owner(workspace_id));

-- projects
create policy "projects_select_member" on public.projects
for select
using (public.is_workspace_member(workspace_id));

create policy "projects_insert_member" on public.projects
for insert
with check (public.is_workspace_member(workspace_id));

create policy "projects_update_member" on public.projects
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "projects_delete_member" on public.projects
for delete
using (public.is_workspace_member(workspace_id));

-- project_versions (access via owning project's workspace)
create policy "project_versions_select_member" on public.project_versions
for select
using (
  exists (
    select 1
    from public.projects p
    join public.memberships m on m.workspace_id = p.workspace_id
    where p.id = project_versions.project_id
      and m.user_id = auth.uid()
  )
);

create policy "project_versions_insert_member" on public.project_versions
for insert
with check (
  exists (
    select 1
    from public.projects p
    join public.memberships m on m.workspace_id = p.workspace_id
    where p.id = project_versions.project_id
      and m.user_id = auth.uid()
  )
);

create policy "project_versions_update_member" on public.project_versions
for update
using (
  exists (
    select 1
    from public.projects p
    join public.memberships m on m.workspace_id = p.workspace_id
    where p.id = project_versions.project_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    join public.memberships m on m.workspace_id = p.workspace_id
    where p.id = project_versions.project_id
      and m.user_id = auth.uid()
  )
);

create policy "project_versions_delete_member" on public.project_versions
for delete
using (
  exists (
    select 1
    from public.projects p
    join public.memberships m on m.workspace_id = p.workspace_id
    where p.id = project_versions.project_id
      and m.user_id = auth.uid()
  )
);

-- assets
create policy "assets_select_member" on public.assets
for select
using (public.is_workspace_member(workspace_id));

create policy "assets_insert_member" on public.assets
for insert
with check (public.is_workspace_member(workspace_id));

create policy "assets_update_member" on public.assets
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "assets_delete_member" on public.assets
for delete
using (public.is_workspace_member(workspace_id));

-- render_jobs
create policy "render_jobs_select_member" on public.render_jobs
for select
using (public.is_workspace_member(workspace_id));

create policy "render_jobs_insert_member" on public.render_jobs
for insert
with check (public.is_workspace_member(workspace_id));

create policy "render_jobs_update_member" on public.render_jobs
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "render_jobs_delete_member" on public.render_jobs
for delete
using (public.is_workspace_member(workspace_id));

-- render_outputs (access via render_job -> workspace)
create policy "render_outputs_select_member" on public.render_outputs
for select
using (
  exists (
    select 1
    from public.render_jobs rj
    where rj.id = render_outputs.render_job_id
      and public.is_workspace_member(rj.workspace_id)
  )
);

create policy "render_outputs_insert_member" on public.render_outputs
for insert
with check (
  exists (
    select 1
    from public.render_jobs rj
    where rj.id = render_outputs.render_job_id
      and public.is_workspace_member(rj.workspace_id)
  )
);

create policy "render_outputs_update_member" on public.render_outputs
for update
using (
  exists (
    select 1
    from public.render_jobs rj
    where rj.id = render_outputs.render_job_id
      and public.is_workspace_member(rj.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.render_jobs rj
    where rj.id = render_outputs.render_job_id
      and public.is_workspace_member(rj.workspace_id)
  )
);

create policy "render_outputs_delete_member" on public.render_outputs
for delete
using (
  exists (
    select 1
    from public.render_jobs rj
    where rj.id = render_outputs.render_job_id
      and public.is_workspace_member(rj.workspace_id)
  )
);

-- credit_ledgers
create policy "credit_ledgers_select_member" on public.credit_ledgers
for select
using (public.is_workspace_member(workspace_id));

create policy "credit_ledgers_insert_member" on public.credit_ledgers
for insert
with check (public.is_workspace_member(workspace_id));

create policy "credit_ledgers_update_member" on public.credit_ledgers
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "credit_ledgers_delete_member" on public.credit_ledgers
for delete
using (public.is_workspace_member(workspace_id));

-- credit_events (access via credit_ledger -> workspace)
create policy "credit_events_select_member" on public.credit_events
for select
using (
  exists (
    select 1
    from public.credit_ledgers cl
    where cl.id = credit_events.credit_ledger_id
      and public.is_workspace_member(cl.workspace_id)
  )
);

create policy "credit_events_insert_member" on public.credit_events
for insert
with check (
  exists (
    select 1
    from public.credit_ledgers cl
    where cl.id = credit_events.credit_ledger_id
      and public.is_workspace_member(cl.workspace_id)
  )
);

create policy "credit_events_update_member" on public.credit_events
for update
using (
  exists (
    select 1
    from public.credit_ledgers cl
    where cl.id = credit_events.credit_ledger_id
      and public.is_workspace_member(cl.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.credit_ledgers cl
    where cl.id = credit_events.credit_ledger_id
      and public.is_workspace_member(cl.workspace_id)
  )
);

create policy "credit_events_delete_member" on public.credit_events
for delete
using (
  exists (
    select 1
    from public.credit_ledgers cl
    where cl.id = credit_events.credit_ledger_id
      and public.is_workspace_member(cl.workspace_id)
  )
);

-- subscriptions
create policy "subscriptions_select_member" on public.subscriptions
for select
using (public.is_workspace_member(workspace_id));

create policy "subscriptions_insert_member" on public.subscriptions
for insert
with check (public.is_workspace_member(workspace_id));

create policy "subscriptions_update_member" on public.subscriptions
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "subscriptions_delete_member" on public.subscriptions
for delete
using (public.is_workspace_member(workspace_id));
