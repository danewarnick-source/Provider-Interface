-- Meds rebuild M1: dose fields for route, PRN follow-up and offline retry
-- safety, plus a database-level guard against charting a taken dose twice.
alter table public.emar_logs
  add column if not exists route text,
  add column if not exists prn_effect text,
  add column if not exists prn_followup_due_at timestamptz,
  add column if not exists prn_followup_at timestamptz,
  add column if not exists prn_followup_by uuid,
  add column if not exists prn_tried_first text,
  add column if not exists prescriber_notified boolean,
  -- Every dose gets one. The server passes the browser's id so a retried
  -- pass never creates a second row; the default covers main's older paths.
  add column if not exists client_request_id uuid not null default gen_random_uuid();

alter table public.emar_logs
  add constraint emar_logs_prn_effect_check check (prn_effect is null or prn_effect in ('helped', 'partly', 'no')),
  add constraint emar_logs_client_request_id_key unique (client_request_id);

-- emar_logs_terminal_dedupe misses 'administered' (what the code saves).
-- Scoped to source 'emar' because main's shift screen still stamps every dose
-- with the shift start; M5 replaces that screen and M6 can widen this index.
-- Checked on live before applying: no duplicate administered rows.
create unique index if not exists emar_logs_administered_dedupe
  on public.emar_logs (medication_id, scheduled_for)
  where status = 'administered' and source = 'emar';
