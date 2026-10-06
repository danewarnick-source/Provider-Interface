-- Clients rebuild P11: discharge records (additive only).
--
-- client_discharges: one row per discharge. Holds the date, the reason, who
--   started it (agency / the person / DSPD), the notice date, the discharge
--   summary (Nectar may draft it; a person confirms it), when the summary was
--   sent (the 7-day clock), and a snapshot of what the discharge ended
--   (authorizations, team members, future shifts). Reactivating a client
--   stamps reactivated_at; the row is kept. Never deleted.
-- RLS: read with Clients: View, write with Clients: Edit, both on a client
--   the user can see. No delete policy.

create table if not exists public.client_discharges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  discharge_date date not null,
  reason text not null check (length(btrim(reason)) > 0),
  initiated_by text not null check (initiated_by in ('agency', 'person', 'dspd')),
  notice_date date,
  summary_text text,
  summary_drafted_by_nectar boolean not null default false,
  summary_confirmed_at timestamptz,
  summary_confirmed_by uuid,
  summary_document_id uuid references public.client_documents(id) on delete set null,
  summary_sent_on date,
  ended_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  reactivated_at timestamptz,
  reactivated_by uuid
);
create index if not exists client_discharges_client_idx
  on public.client_discharges (client_id, created_at desc);
create index if not exists client_discharges_open_summary_idx
  on public.client_discharges (organization_id, discharge_date)
  where summary_sent_on is null and reactivated_at is null;

alter table public.client_discharges enable row level security;

drop policy if exists "clients viewers read discharges" on public.client_discharges;
create policy "clients viewers read discharges" on public.client_discharges
  for select using (
    access_has_category(organization_id, auth.uid(), 'clients', 'view')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors insert discharges" on public.client_discharges;
create policy "clients editors insert discharges" on public.client_discharges
  for insert with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
drop policy if exists "clients editors update discharges" on public.client_discharges;
create policy "clients editors update discharges" on public.client_discharges
  for update using (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  ) with check (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    and access_can_see_client(client_id, auth.uid())
  );
