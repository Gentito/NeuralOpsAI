do $$
begin
  if not exists (select 1 from pg_type where typname = 'automation_job_status') then
    create type public.automation_job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
  end if;
end $$;

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type null,
  entity_id uuid null,
  job_type text not null,
  status public.automation_job_status not null default 'queued',
  priority int not null default 100,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text null,
  attempts int not null default 0,
  locked_at timestamptz null,
  locked_by text null,
  scheduled_for timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_jobs_status_idx on public.automation_jobs (status, scheduled_for, priority, created_at);
create index if not exists automation_jobs_org_id_idx on public.automation_jobs (org_id);
create index if not exists automation_jobs_entity_idx on public.automation_jobs (entity_type, entity_id, created_at desc);

create trigger automation_jobs_set_updated_at
before update on public.automation_jobs
for each row execute function public.set_updated_at();

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_events_job_id_idx on public.automation_events (job_id, created_at desc);

alter table public.automation_jobs enable row level security;
alter table public.automation_events enable row level security;

drop policy if exists automation_jobs_select on public.automation_jobs;
create policy automation_jobs_select on public.automation_jobs
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'agent' and public.is_org_member(org_id))
);

drop policy if exists automation_jobs_insert on public.automation_jobs;
create policy automation_jobs_insert on public.automation_jobs
for insert to authenticated
with check (public.is_admin() or public.current_user_role() = 'agent');

drop policy if exists automation_jobs_update on public.automation_jobs;
create policy automation_jobs_update on public.automation_jobs
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists automation_events_select on public.automation_events;
create policy automation_events_select on public.automation_events
for select to authenticated
using (
  exists (
    select 1
    from public.automation_jobs j
    where j.id = public.automation_events.job_id
      and (public.is_admin() or (public.current_user_role() = 'agent' and public.is_org_member(j.org_id)))
  )
);

drop policy if exists automation_events_insert on public.automation_events;
create policy automation_events_insert on public.automation_events
for insert to authenticated
with check (public.is_admin());

create or replace function public.claim_next_automation_job(worker_id text)
returns public.automation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.automation_jobs;
begin
  update public.automation_jobs j
  set
    status = 'running',
    locked_at = now(),
    locked_by = worker_id,
    attempts = attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.automation_jobs
    where status = 'queued'
      and scheduled_for <= now()
    order by priority asc, created_at asc
    for update skip locked
    limit 1
  )
  returning * into job;

  return job;
end;
$$;

