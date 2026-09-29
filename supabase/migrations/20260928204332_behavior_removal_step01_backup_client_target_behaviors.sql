-- Step 1. Copy the 1 client_target_behaviors row before that table is dropped.
CREATE TABLE IF NOT EXISTS public.client_target_behaviors_backup_20260928c
AS SELECT * FROM public.client_target_behaviors;
