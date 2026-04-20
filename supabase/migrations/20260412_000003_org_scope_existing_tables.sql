alter table public.clients add column if not exists org_id uuid null references public.organizations(id) on delete set null;
alter table public.projects add column if not exists org_id uuid null references public.organizations(id) on delete set null;
alter table public.projects add column if not exists request_id uuid null references public.requests(id) on delete set null;
alter table public.tasks add column if not exists org_id uuid null references public.organizations(id) on delete set null;
alter table public.tasks add column if not exists request_id uuid null references public.requests(id) on delete set null;
alter table public.tasks add column if not exists assigned_user_id uuid null references auth.users(id) on delete set null;
alter table public.invoices add column if not exists org_id uuid null references public.organizations(id) on delete set null;
alter table public.chat_messages add column if not exists org_id uuid null references public.organizations(id) on delete set null;

update public.clients set org_id = public.ensure_internal_org() where org_id is null;
update public.projects set org_id = public.ensure_internal_org() where org_id is null;
update public.tasks set org_id = public.ensure_internal_org() where org_id is null;
update public.invoices set org_id = public.ensure_internal_org() where org_id is null;
update public.chat_messages set org_id = public.ensure_internal_org() where org_id is null;

create index if not exists clients_org_id_idx on public.clients (org_id);
create index if not exists projects_org_id_idx on public.projects (org_id);
create index if not exists projects_request_id_idx on public.projects (request_id);
create index if not exists tasks_org_id_idx on public.tasks (org_id);
create index if not exists tasks_request_id_idx on public.tasks (request_id);
create index if not exists tasks_assigned_user_id_idx on public.tasks (assigned_user_id);
create index if not exists invoices_org_id_idx on public.invoices (org_id);
create index if not exists chat_messages_org_id_idx on public.chat_messages (org_id);

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.invoices enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists clients_select_own on public.clients;
drop policy if exists clients_insert_own on public.clients;
drop policy if exists clients_update_own on public.clients;
drop policy if exists clients_delete_own on public.clients;

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;

drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;

drop policy if exists invoices_select_own on public.invoices;
drop policy if exists invoices_insert_own on public.invoices;
drop policy if exists invoices_update_own on public.invoices;
drop policy if exists invoices_delete_own on public.invoices;

drop policy if exists chat_messages_select_own on public.chat_messages;
drop policy if exists chat_messages_insert_own on public.chat_messages;
drop policy if exists chat_messages_delete_own on public.chat_messages;

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
for select to authenticated
using (public.is_admin() or (public.current_user_role() = 'client' and public.is_org_member(org_id)));

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'project' and a.entity_id = public.projects.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
for insert to authenticated
with check (public.is_admin());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'project' and a.entity_id = public.projects.id and a.agent_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'project' and a.entity_id = public.projects.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
for delete to authenticated
using (public.is_admin());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'task' and a.entity_id = public.tasks.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
for insert to authenticated
with check (public.is_admin());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'task' and a.entity_id = public.tasks.id and a.agent_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'task' and a.entity_id = public.tasks.id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
for delete to authenticated
using (public.is_admin());

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
for select to authenticated
using (public.is_admin() or (public.current_user_role() = 'client' and public.is_org_member(org_id)));

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
for insert to authenticated
with check (public.is_admin());

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
for delete to authenticated
using (public.is_admin());

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'project' and a.entity_id = public.chat_messages.project_id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
for insert to authenticated
with check (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id))
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = 'project' and a.entity_id = public.chat_messages.project_id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages
for delete to authenticated
using (public.is_admin());

