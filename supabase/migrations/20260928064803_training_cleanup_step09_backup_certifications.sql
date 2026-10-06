-- Step 9. Copy certification rows (none on 2026-09-28) into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_certifications AS TABLE public.certifications;
