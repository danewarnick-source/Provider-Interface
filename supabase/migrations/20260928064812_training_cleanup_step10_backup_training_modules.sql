-- Step 10. Copy the 6 training-module rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_modules AS TABLE public.training_modules;
