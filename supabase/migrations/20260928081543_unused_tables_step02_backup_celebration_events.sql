-- Step 2. Copy celebration_events (5 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.celebration_events_backup_20260928b AS SELECT * FROM public.celebration_events;
ALTER TABLE public.celebration_events_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_events_backup_20260928b FROM anon, authenticated;
