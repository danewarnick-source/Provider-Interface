-- Meds rebuild M1: a medication-error incident links to the dose it is about.
alter table public.incident_reports
  add column if not exists emar_log_id uuid references public.emar_logs(id);
create index if not exists incident_reports_emar_log_id_idx
  on public.incident_reports (emar_log_id) where emar_log_id is not null;
