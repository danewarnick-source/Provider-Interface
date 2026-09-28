-- Step 14. Copy the 22 training-topic rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_topics AS TABLE public.training_topics;
