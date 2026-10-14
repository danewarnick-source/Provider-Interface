-- Meds rebuild M3 (audit): monthly MAR sign-off.
-- A signed month can't be changed. The only change allowed on a review row
-- is reopening it (with a reason), and a reopened month can be signed
-- again. Every sign-off and reopening is logged in
-- medication_month_review_events (insert-only). Rows are written only by
-- server functions after assertCanManageClient(edit_medical); reads follow
-- the client's PHI access. Nothing here is used by main.

alter table public.medication_month_reviews
  add column if not exists status text not null default 'signed',
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid,
  add column if not exists reopen_reason text;

alter table public.medication_month_reviews
  add constraint medication_month_reviews_status_check
  check (status in ('signed', 'reopened'));

create table if not exists public.medication_month_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id) on delete restrict,
  review_id uuid not null references public.medication_month_reviews(id) on delete restrict,
  month date not null,
  action text not null check (action in ('sign', 'reopen')),
  actor_id uuid,
  at timestamptz not null default now(),
  reason text,
  pdf_path text
);
create index if not exists medication_month_review_events_client_idx
  on public.medication_month_review_events (client_id, month, at desc);
alter table public.medication_month_review_events enable row level security;
create policy "phi readers read med month review events"
  on public.medication_month_review_events
  for select to authenticated using (public.can_access_client_phi(client_id));

create or replace function public.medication_month_reviews_lock()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A monthly medication review can''t be removed.' using errcode = '42501';
  end if;
  if new.organization_id is distinct from old.organization_id
     or new.client_id is distinct from old.client_id
     or new.month is distinct from old.month then
    raise exception 'A monthly medication review can''t be moved.' using errcode = '42501';
  end if;
  if old.status = 'signed' then
    -- Signed: only reopening, with a reason; what was signed stays as it was.
    if new.status <> 'reopened'
       or coalesce(btrim(new.reopen_reason), '') = ''
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.notes is distinct from old.notes
       or new.pdf_path is distinct from old.pdf_path then
      raise exception 'This month is signed off. Reopen it (with a reason) to change it.'
        using errcode = '42501';
    end if;
  elsif new.status <> 'signed' then
    raise exception 'A reopened month can only be signed off again.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_medication_month_reviews_lock
  before update or delete on public.medication_month_reviews
  for each row execute function public.medication_month_reviews_lock();

create or replace function public.medication_month_review_events_insert_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  raise exception 'The sign-off log can''t be changed.' using errcode = '42501';
end;
$$;

create trigger trg_medication_month_review_events_insert_only
  before update or delete on public.medication_month_review_events
  for each row execute function public.medication_month_review_events_insert_only();
