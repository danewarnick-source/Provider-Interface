-- Clients rebuild P8: health events log and absences (additive only).
--
-- client_health_events: exams, injuries, surgeries, immunizations, health
--   changes and hospital stays, each optionally pointing at a client document.
-- client_absences: days the client is away (hospital / vacation / other).
--   Shown for RHS clients; residential billing reads it later.
-- RLS: read = Client medical: View on a client the user can see;
--      write = Client medical: Edit on a client the user can see.
-- Nothing is deleted: rows are archived (archived_at), never removed.

create table if not exists public.client_health_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  event_date date not null,
  event_type text not null check (event_type in ('exam','injury','surgery','immunization','health_change','hospital')),
  notes text,
  document_id uuid references public.client_documents(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists client_health_events_client_idx
  on public.client_health_events (client_id, event_date desc);

create table if not exists public.client_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  from_date date not null,
  to_date date,
  reason text not null check (reason in ('hospital','vacation','other')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint client_absences_dates_check check (to_date is null or to_date >= from_date)
);
create index if not exists client_absences_client_idx
  on public.client_absences (client_id, from_date desc);

alter table public.client_health_events enable row level security;
alter table public.client_absences enable row level security;

drop policy if exists "medical viewers read health events" on public.client_health_events;
create policy "medical viewers read health events" on public.client_health_events
  for select using (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'view')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "medical editors insert health events" on public.client_health_events;
create policy "medical editors insert health events" on public.client_health_events
  for insert with check (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "medical editors update health events" on public.client_health_events;
create policy "medical editors update health events" on public.client_health_events
  for update using (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  ) with check (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );

drop policy if exists "medical viewers read absences" on public.client_absences;
create policy "medical viewers read absences" on public.client_absences
  for select using (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'view')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "medical editors insert absences" on public.client_absences;
create policy "medical editors insert absences" on public.client_absences
  for insert with check (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "medical editors update absences" on public.client_absences;
create policy "medical editors update absences" on public.client_absences
  for update using (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  ) with check (
    access_has_category(organization_id, auth.uid(), 'client_medical', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );

grant select, insert, update on public.client_health_events to authenticated;
grant select, insert, update on public.client_absences to authenticated;
