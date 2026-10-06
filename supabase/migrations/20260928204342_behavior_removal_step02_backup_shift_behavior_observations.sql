-- Step 2. Copy the 3 shift_behavior_observations rows before that table is dropped.
CREATE TABLE IF NOT EXISTS public.shift_behavior_observations_backup_20260928c
AS SELECT * FROM public.shift_behavior_observations;
