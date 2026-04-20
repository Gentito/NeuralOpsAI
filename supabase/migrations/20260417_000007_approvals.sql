do $$
begin
  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type public.approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type null,
  entity_id uuid null,
  approval_type text not null,
  status public.approval_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid null references auth.users(id) on delete set null default auth.uid(),
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  decision_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approvals_org_id_idx on public.approvals (org_id);
create index if not exists approvals_status_idx on public.approvals (status, created_at desc);
create index if not exists approvals_entity_idx on public.approvals (entity_type, entity_id, created_at desc);

create trigger approvals_set_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

alter table public.approvals enable row level security;

drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals
for select to authenticated
using (public.is_admin());

drop policy if exists approvals_insert on public.approvals;
create policy approvals_insert on public.approvals
for insert to authenticated
with check (public.is_admin() or public.current_user_role() = 'agent');

drop policy if exists approvals_update on public.approvals;
create policy approvals_update on public.approvals
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

