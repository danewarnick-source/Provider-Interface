-- Step 3. Copy celebration_acknowledgements (13 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.celebration_acknowledgements_backup_20260928b AS SELECT * FROM public.celebration_acknowledgements;
ALTER TABLE public.celebration_acknowledgements_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_acknowledgements_backup_20260928b FROM anon, authenticated;
