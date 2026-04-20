create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'system_actor_kind') then
    create type public.system_actor_kind as enum ('automation', 'trae_agent', 'integration_worker');
  end if;
  if not exists (select 1 from pg_type where typname = 'system_actor_status') then
    create type public.system_actor_status as enum ('active', 'disabled');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('active', 'released');
  end if;
  if not exists (select 1 from pg_type where typname = 'deliverable_visibility') then
    create type public.deliverable_visibility as enum ('internal', 'client');
  end if;
end $$;

create table if not exists public.system_actors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind public.system_actor_kind not null,
  name text not null,
  status public.system_actor_status not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_actors_org_id_idx on public.system_actors (org_id);
create index if not exists system_actors_kind_idx on public.system_actors (kind);

create trigger system_actors_set_updated_at
before update on public.system_actors
for each row execute function public.set_updated_at();

create table if not exists public.system_actor_tokens (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.system_actors(id) on delete cascade,
  token_hash text not null unique,
  label text null,
  status public.system_actor_status not null default 'active',
  last_used_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists system_actor_tokens_actor_id_idx on public.system_actor_tokens (actor_id);

create table if not exists public.system_actor_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type not null,
  entity_id uuid not null,
  actor_id uuid not null references public.system_actors(id) on delete cascade,
  status public.assignment_status not null default 'active',
  assigned_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz null
);

create unique index if not exists system_actor_assignments_unique_active
on public.system_actor_assignments (entity_type, entity_id, actor_id)
where status = 'active';

create index if not exists system_actor_assignments_actor_id_idx on public.system_actor_assignments (actor_id, created_at desc);
create index if not exists system_actor_assignments_entity_idx on public.system_actor_assignments (entity_type, entity_id, created_at desc);

create table if not exists public.agent_action_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.system_actors(id) on delete cascade,
  entity_type public.linked_entity_type not null,
  entity_id uuid not null,
  action text not null,
  reversible boolean not null default false,
  reversal_of uuid null references public.agent_action_logs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_action_logs_actor_idx on public.agent_action_logs (actor_id, created_at desc);
create index if not exists agent_action_logs_entity_idx on public.agent_action_logs (entity_type, entity_id, created_at desc);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status text null,
  to_status text not null,
  changed_by_user_id uuid null references auth.users(id) on delete set null,
  changed_by_actor_id uuid null references public.system_actors(id) on delete set null,
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists task_status_history_task_idx on public.task_status_history (task_id, created_at desc);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type not null,
  entity_id uuid not null,
  title text not null,
  body text not null,
  mime_type text not null default 'text/plain',
  visibility public.deliverable_visibility not null default 'internal',
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_by_actor_id uuid null references public.system_actors(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists deliverables_entity_idx on public.deliverables (entity_type, entity_id, created_at desc);

alter table public.system_actors enable row level security;
alter table public.system_actor_tokens enable row level security;
alter table public.system_actor_assignments enable row level security;
alter table public.agent_action_logs enable row level security;
alter table public.task_status_history enable row level security;
alter table public.deliverables enable row level security;

drop policy if exists system_actors_select on public.system_actors;
create policy system_actors_select on public.system_actors
for select to authenticated
using (public.is_admin());

drop policy if exists system_actors_write on public.system_actors;
create policy system_actors_write on public.system_actors
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists system_actor_tokens_select on public.system_actor_tokens;
create policy system_actor_tokens_select on public.system_actor_tokens
for select to authenticated
using (public.is_admin());

drop policy if exists system_actor_tokens_write on public.system_actor_tokens;
create policy system_actor_tokens_write on public.system_actor_tokens
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists system_actor_assignments_select on public.system_actor_assignments;
create policy system_actor_assignments_select on public.system_actor_assignments
for select to authenticated
using (public.is_admin());

drop policy if exists system_actor_assignments_write on public.system_actor_assignments;
create policy system_actor_assignments_write on public.system_actor_assignments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists agent_action_logs_select on public.agent_action_logs;
create policy agent_action_logs_select on public.agent_action_logs
for select to authenticated
using (public.is_admin());

drop policy if exists agent_action_logs_insert on public.agent_action_logs;
create policy agent_action_logs_insert on public.agent_action_logs
for insert to authenticated
with check (public.is_admin());

drop policy if exists task_status_history_select on public.task_status_history;
create policy task_status_history_select on public.task_status_history
for select to authenticated
using (public.is_admin());

drop policy if exists task_status_history_insert on public.task_status_history;
create policy task_status_history_insert on public.task_status_history
for insert to authenticated
with check (public.is_admin());

drop policy if exists deliverables_select on public.deliverables;
create policy deliverables_select on public.deliverables
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id) and visibility = 'client')
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = public.deliverables.entity_type
      and a.entity_id = public.deliverables.entity_id
      and a.agent_user_id = auth.uid()
  )
);

drop policy if exists deliverables_insert on public.deliverables;
create policy deliverables_insert on public.deliverables
for insert to authenticated
with check (public.is_admin());

alter table public.comments add column if not exists created_by_actor_id uuid null references public.system_actors(id) on delete set null;

