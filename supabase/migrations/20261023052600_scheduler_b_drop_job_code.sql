-- PHASE B — apply only after Scheduler B1 (Foundations) is on main
-- Nothing in main reads or writes scheduled_shifts.job_code once B1 ships;
-- service_code is the one column. Removes the Phase A mirror trigger with it.
-- Rows: every live job_code equals service_code (checked Oct 23, 2026), so no data is lost.
DROP TRIGGER IF EXISTS scheduled_shifts_mirror_job_code ON public.scheduled_shifts;
DROP FUNCTION IF EXISTS public.scheduled_shifts_mirror_job_code();
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS job_code;
