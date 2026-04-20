alter table public.email_messages add column if not exists request_id uuid null references public.requests(id) on delete set null;
create index if not exists email_messages_request_id_idx on public.email_messages (request_id);

