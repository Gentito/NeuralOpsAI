do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_visibility') then
    create type public.comment_visibility as enum ('internal', 'client');
  end if;
end $$;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type public.linked_entity_type not null,
  entity_id uuid not null,
  visibility public.comment_visibility not null default 'internal',
  body text not null,
  created_by uuid null references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists comments_org_id_idx on public.comments (org_id);
create index if not exists comments_entity_idx on public.comments (entity_type, entity_id, created_at desc);
create index if not exists comments_created_by_idx on public.comments (created_by, created_at desc);

alter table public.comments enable row level security;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
for select to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id) and visibility = 'client')
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = public.comments.entity_type and a.entity_id = public.comments.entity_id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
for insert to authenticated
with check (
  public.is_admin()
  or (public.current_user_role() = 'client' and public.is_org_member(org_id) and visibility = 'client')
  or exists (
    select 1 from public.agent_assignments a
    where a.entity_type = public.comments.entity_type and a.entity_id = public.comments.entity_id and a.agent_user_id = auth.uid()
  )
);

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
for delete to authenticated
using (public.is_admin());

create or replace function public.comments_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare vis public.activity_visibility;
begin
  if new.visibility = 'client' then
    vis := 'client';
  else
    vis := 'internal';
  end if;

  perform public.log_activity(
    new.org_id,
    coalesce(new.created_by, auth.uid()),
    'comment.created',
    new.entity_type,
    new.entity_id,
    vis,
    jsonb_build_object('comment_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists comments_activity on public.comments;
create trigger comments_activity
after insert on public.comments
for each row execute function public.comments_activity_trigger();

update public.clients set org_id = public.ensure_internal_org() where org_id is null;
update public.projects set org_id = public.ensure_internal_org() where org_id is null;
update public.tasks set org_id = public.ensure_internal_org() where org_id is null;
update public.invoices set org_id = public.ensure_internal_org() where org_id is null;
update public.chat_messages set org_id = public.ensure_internal_org() where org_id is null;

alter table public.clients alter column org_id set default public.ensure_internal_org();
alter table public.projects alter column org_id set default public.ensure_internal_org();
alter table public.tasks alter column org_id set default public.ensure_internal_org();
alter table public.invoices alter column org_id set default public.ensure_internal_org();
alter table public.chat_messages alter column org_id set default public.ensure_internal_org();

alter table public.clients alter column org_id set not null;
alter table public.projects alter column org_id set not null;
alter table public.tasks alter column org_id set not null;
alter table public.invoices alter column org_id set not null;
alter table public.chat_messages alter column org_id set not null;

