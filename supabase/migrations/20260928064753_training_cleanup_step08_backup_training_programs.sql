-- Step 8. Copy the 4 training-program rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_programs AS TABLE public.training_programs;
