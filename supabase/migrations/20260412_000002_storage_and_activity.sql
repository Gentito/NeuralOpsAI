do $$
begin
  if not exists (select 1 from storage.buckets where id = 'attachments') then
    insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
  end if;
end $$;

create or replace function public.org_id_from_storage_path(path text)
returns uuid
language sql
stable
as $$
  select nullif(split_part(path, '/', 1), '')::uuid;
$$;

drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    public.is_admin()
    or public.is_org_member(public.org_id_from_storage_path(name))
  )
);

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (
    public.is_admin()
    or public.is_org_member(public.org_id_from_storage_path(name))
  )
);

drop policy if exists attachments_update on storage.objects;
create policy attachments_update on storage.objects
for update to authenticated
using (bucket_id = 'attachments' and public.is_admin())
with check (bucket_id = 'attachments' and public.is_admin());

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
for delete to authenticated
using (bucket_id = 'attachments' and public.is_admin());

create or replace function public.log_activity(
  org_id uuid,
  actor_user_id uuid,
  action text,
  entity_type public.linked_entity_type,
  entity_id uuid,
  visibility public.activity_visibility,
  metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (org_id, actor_user_id, action, entity_type, entity_id, visibility, metadata)
  values (org_id, actor_user_id, action, entity_type, entity_id, visibility, coalesce(metadata, '{}'::jsonb));
end;
$$;

create or replace function public.requests_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.log_activity(
      new.org_id,
      coalesce(new.created_by, auth.uid()),
      'request.created',
      'request',
      new.id,
      'client',
      jsonb_build_object('title', new.title, 'category', new.category, 'priority', new.priority, 'source', new.source)
    );
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      perform public.log_activity(
        new.org_id,
        auth.uid(),
        'request.status_changed',
        'request',
        new.id,
        'client',
        jsonb_build_object('from', old.status, 'to', new.status)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_activity on public.requests;
create trigger requests_activity
after insert or update on public.requests
for each row execute function public.requests_activity_trigger();

create or replace function public.files_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare vis public.activity_visibility;
begin
  if new.source = 'portal_upload' then
    vis := 'client';
  else
    vis := 'internal';
  end if;

  perform public.log_activity(
    new.org_id,
    coalesce(new.uploaded_by, auth.uid()),
    'file.uploaded',
    new.linked_entity_type,
    new.linked_entity_id,
    vis,
    jsonb_build_object('file_id', new.id, 'name', new.original_name, 'mime_type', new.mime_type, 'size', new.size, 'source', new.source)
  );

  return new;
end;
$$;

drop trigger if exists files_activity on public.files;
create trigger files_activity
after insert on public.files
for each row execute function public.files_activity_trigger();

