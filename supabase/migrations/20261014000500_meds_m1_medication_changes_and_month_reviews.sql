-- Meds rebuild M1: medication change history and monthly MAR sign-off.
-- Reads follow the client's PHI access; writes only via server functions
-- (service role after assertCanManageClient), so no write policies.
create table if not exists public.client_medication_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id) on delete restrict,
  medication_id uuid not null references public.client_medications(id) on delete restrict,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('add', 'edit', 'pause', 'resume', 'stop', 'send')),
  changes jsonb not null default '{}'::jsonb,
  reason text
);
create index if not exists client_medication_changes_med_idx
  on public.client_medication_changes (medication_id, changed_at desc);
create index if not exists client_medication_changes_client_idx
  on public.client_medication_changes (client_id, changed_at desc);
alter table public.client_medication_changes enable row level security;
create policy "phi readers read med changes" on public.client_medication_changes
  for select to authenticated using (public.can_access_client_phi(client_id));

create table if not exists public.medication_month_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id) on delete restrict,
  month date not null check (month = date_trunc('month', month)::date),
  reviewed_by uuid,
  reviewed_at timestamptz not null default now(),
  notes text,
  pdf_path text,
  unique (client_id, month)
);
alter table public.medication_month_reviews enable row level security;
create policy "phi readers read med month reviews" on public.medication_month_reviews
  for select to authenticated using (public.can_access_client_phi(client_id));
