-- Meds rebuild M5: fields Give meds fills in, plus witness sign-ins.
--
-- emar_logs: when the witness confirmed, which training check passed, and the
-- PRN follow-up note. controlled_med_counts: the count after the dose, what
-- the server expected after it, and the confirmed witness.
--
-- med_witness_confirmations: a witness signs in with their own account on the
-- staff member's phone. The server checks the password and that the witness
-- is a different active member of the agency, then writes one row here (as
-- the service role). log_medication_dose uses each row once, within 15
-- minutes, for the staff member and medication it was made for. The browser
-- never names the witness directly.
alter table public.emar_logs
  add column if not exists witness_confirmed_at timestamptz,
  add column if not exists training_checked text,
  add column if not exists prn_followup_note text;

alter table public.emar_logs
  add constraint emar_logs_training_checked_check
  check (training_checked is null or training_checked in ('approved', 'not_set_up'));

alter table public.controlled_med_counts
  add column if not exists count_after integer,
  add column if not exists expected_after integer,
  add column if not exists witness_id uuid,
  add column if not exists witness_confirmed_at timestamptz;

create table if not exists public.med_witness_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  medication_id uuid not null references public.client_medications(id),
  witness_id uuid not null,
  requested_by uuid not null,
  confirmed_at timestamptz not null default now(),
  used_at timestamptz,
  emar_log_id uuid references public.emar_logs(id)
);

create index if not exists med_witness_confirmations_requested_by_idx
  on public.med_witness_confirmations (requested_by, confirmed_at desc);

alter table public.med_witness_confirmations enable row level security;

-- Read-only for people who can see the client's health records. No insert,
-- update or delete rule: only the server writes these rows.
create policy "phi readers read witness confirmations"
  on public.med_witness_confirmations
  for select to authenticated
  using (public.can_access_client_phi(client_id));
