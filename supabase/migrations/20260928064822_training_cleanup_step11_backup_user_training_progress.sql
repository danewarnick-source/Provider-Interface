-- Step 11. Copy the 7 training-progress rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_user_training_progress AS TABLE public.user_training_progress;
