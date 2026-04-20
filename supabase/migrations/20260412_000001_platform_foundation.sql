create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('super_admin', 'internal_admin', 'agent', 'client');
  end if;
  if not exists (select 1 from pg_type where typname = 'organization_type') then
    create type public.organization_type as enum ('internal', 'client');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('new', 'triaged', 'in_review', 'assigned', 'in_progress', 'waiting_for_client', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_priority') then
    create type public.request_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'file_source') then
    create type public.file_source as enum ('portal_upload', 'email_attachment', 'internal_upload');
  end if;
  if not exists (select 1 from pg_type where typname = 'linked_entity_type') then
    create type public.linked_entity_type as enum ('request', 'project', 'task');
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_visibility') then
    create type public.activity_visibility as enum ('internal', 'client');
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.organization_type not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_type_idx on public.organizations (type);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text null,
  company_name text null,
  email text null,
  phone text null,
  status text not null default 'active',
  primary_org_id uuid null references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_primary_org_id_idx on public.profiles (primary_org_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.organization_memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_memberships_user_id_idx on public.organization_memberships (user_id);

create or replace function public.ensure_internal_org()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare internal_org_id uuid;
begin
  select id into internal_org_id from public.organizations where type = 'internal' order by created_at asc limit 1;
  if internal_org_id is not null then
    return internal_org_id;
  end if;

  insert into public.organizations (name, type, status) values ('NeuralOps AI', 'internal', 'active') returning id into internal_org_id;
  return internal_org_id;
end;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select primary_org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'client'::public.user_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('super_admin', 'internal_admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.org_id = target_org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_text text;
  normalized_role public.user_role;
  org_id uuid;
  full_name text;
  company_name text;
begin
  role_text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  if role_text in ('super_admin', 'internal_admin', 'agent', 'client') then
    normalized_role := role_text::public.user_role;
  else
    normalized_role := 'client';
  end if;

  full_name := nullif(new.raw_user_meta_data ->> 'full_name', '');
  company_name := nullif(new.raw_user_meta_data ->> 'company_name', '');

  if normalized_role in ('super_admin', 'internal_admin', 'agent') then
    org_id := public.ensure_internal_org();
  else
    insert into public.organizations (name, type, status)
    values (coalesce(company_name, new.email), 'client', 'active')
    returning id into org_id;
  end if;

  insert into public.profiles (id, role, full_name, company_name, email, status, primary_org_id)
  values (new.id, normalized_role, full_name, company_name, new.email, 'active', org_id)
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_name = coalesce(excluded.company_name, public.profiles.company_name),
    email = excluded.email,
    primary_org_id = coalesce(excluded.primary_org_id, public.profiles.primary_org_id);

  insert into public.organization_memberships (org_id, user_id)
  values (org_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade default public.current_org_id(),
  created_by uuid null references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  description text not null,
  category text not null,
  priority public.request_priority not null default 'medium',
  preferred_deadline date null,
  budget numeric null,
  status public.request_status not null default 'new',
  contact_email text null,
  contact_phone text null,
  source text not null default 'portal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_org_id_idx on public.requests (org_id);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_priority_idx on public.requests (priority);
create index if not exists requests_created_at_idx on public.requests (created_at desc);

create trigger requests_set_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create table if not exists public.agent_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type not null,
  entity_id uuid not null,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_assignments_unique_idx
on public.agent_assignments (entity_type, entity_id, agent_user_id);

create index if not exists agent_assignments_agent_user_id_idx on public.agent_assignments (agent_user_id);
create index if not exists agent_assignments_org_id_idx on public.agent_assignments (org_id);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  mime_type text not null,
  size bigint not null,
  source public.file_source not null,
  linked_entity_type public.linked_entity_type not null,
  linked_entity_id uuid not null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists files_org_id_idx on public.files (org_id);
create index if not exists files_link_idx on public.files (linked_entity_type, linked_entity_id);
create index if not exists files_uploaded_by_idx on public.files (uploaded_by);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete set null,
  provider text not null,
  provider_message_id text not null,
  thread_id text null,
  from_email text not null,
  from_name text null,
  subject text null,
  text_body text null,
  html_body text null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists email_messages_provider_uidx on public.email_messages (provider, provider_message_id);
create index if not exists email_messages_from_email_idx on public.email_messages (from_email);
create index if not exists email_messages_thread_id_idx on public.email_messages (thread_id);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type public.linked_entity_type null,
  entity_id uuid null,
  visibility public.activity_visibility not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_org_id_idx on public.activity_logs (org_id);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete set null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.requests enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.files enable row level security;
alter table public.email_messages enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select to authenticated
using (public.is_org_member(id) or public.is_admin());

drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select on public.organization_memberships
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists memberships_insert on public.organization_memberships;
create policy memberships_insert on public.organization_memberships
for insert to authenticated
with check (public.is_admin());

drop policy if exists memberships_delete on public.organization_memberships;
create policy memberships_delete on public.organization_memberships
for delete to authenticated
using (public.is_admin());

drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'request' and a.entity_id = public.requests.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests
for insert to authenticated
with check (public.current_user_role() = 'client' and public.is_org_member(org_id));

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'request' and a.entity_id = public.requests.id and a.agent_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'request' and a.entity_id = public.requests.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists agent_assignments_select on public.agent_assignments;
create policy agent_assignments_select on public.agent_assignments
for select to authenticated
using (public.is_admin() or agent_user_id = auth.uid());

drop policy if exists agent_assignments_insert on public.agent_assignments;
create policy agent_assignments_insert on public.agent_assignments
for insert to authenticated
with check (public.is_admin());

drop policy if exists agent_assignments_delete on public.agent_assignments;
create policy agent_assignments_delete on public.agent_assignments
for delete to authenticated
using (public.is_admin());

drop policy if exists files_select on public.files;
create policy files_select on public.files
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = public.files.linked_entity_type and a.entity_id = public.files.linked_entity_id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists files_insert on public.files;
create policy files_insert on public.files
for insert to authenticated
with check (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
);

drop policy if exists email_messages_select on public.email_messages;
create policy email_messages_select on public.email_messages
for select to authenticated
using (public.is_admin());

drop policy if exists email_messages_insert on public.email_messages;
create policy email_messages_insert on public.email_messages
for insert to authenticated
with check (public.is_admin());

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id) and visibility = 'client')
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = public.activity_logs.entity_type
      and a.entity_id = public.activity_logs.entity_id
      and a.agent_user_id = auth.uid()
  )
);

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update to authenticated
using (recipient_user_id = auth.uid() or public.is_admin())
with check (recipient_user_id = auth.uid() or public.is_admin());
