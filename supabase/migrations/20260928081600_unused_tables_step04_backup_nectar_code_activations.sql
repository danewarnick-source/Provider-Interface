-- Step 4. Copy nectar_code_activations (8 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.nectar_code_activations_backup_20260928b AS SELECT * FROM public.nectar_code_activations;
ALTER TABLE public.nectar_code_activations_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nectar_code_activations_backup_20260928b FROM anon, authenticated;
