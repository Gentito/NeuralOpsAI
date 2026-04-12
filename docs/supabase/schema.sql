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

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  email text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_owner_id_idx on public.clients (owner_id);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  status text not null default 'active',
  client_id uuid null references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_client_id_idx on public.projects (client_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  title text not null,
  status text not null default 'todo',
  assigned_to text null,
  project_id uuid null references public.projects(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_id_idx on public.tasks (owner_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_client_id_idx on public.tasks (client_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  invoice_number text not null,
  status text not null default 'issued',
  client_id uuid null references public.clients(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  currency text not null default 'USD',
  payment_terms text not null default 'Net 14',
  due_date date null,
  tax_rate numeric not null default 0,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoices_owner_number_uidx on public.invoices (owner_id, invoice_number);
create index if not exists invoices_owner_id_idx on public.invoices (owner_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_project_id_idx on public.invoices (project_id);
create index if not exists invoices_status_idx on public.invoices (status);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_key text not null default 'global',
  project_id uuid null references public.projects(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  role text not null,
  agent text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_messages_owner_id_idx on public.chat_messages (owner_id);
create index if not exists chat_messages_conversation_key_idx on public.chat_messages (conversation_key);
create index if not exists chat_messages_project_id_idx on public.chat_messages (project_id);

create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.invoices enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_own on public.clients
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists invoices_insert_own on public.invoices;
create policy invoices_insert_own on public.invoices
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists invoices_update_own on public.invoices;
create policy invoices_update_own on public.invoices
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists invoices_delete_own on public.invoices;
create policy invoices_delete_own on public.invoices
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own on public.chat_messages
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists chat_messages_insert_own on public.chat_messages;
create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists chat_messages_delete_own on public.chat_messages;
create policy chat_messages_delete_own on public.chat_messages
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists agents_read on public.agents;
create policy agents_read on public.agents
for select to anon, authenticated
using (true);

