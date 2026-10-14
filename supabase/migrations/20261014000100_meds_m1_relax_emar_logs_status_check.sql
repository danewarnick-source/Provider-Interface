-- Meds rebuild M1: drop the stale emar_logs_status_check. It allowed only
-- administered/refused/omitted/missed/held, while emar_logs_status_ck (kept)
-- allows every status in use. Relaxing a rule only, so main keeps working.
alter table public.emar_logs drop constraint if exists emar_logs_status_check;
