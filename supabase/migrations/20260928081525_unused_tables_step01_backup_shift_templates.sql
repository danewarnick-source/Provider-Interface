-- Step 1. Copy shift_templates (36 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.shift_templates_backup_20260928b AS SELECT * FROM public.shift_templates;
ALTER TABLE public.shift_templates_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_templates_backup_20260928b FROM anon, authenticated;
