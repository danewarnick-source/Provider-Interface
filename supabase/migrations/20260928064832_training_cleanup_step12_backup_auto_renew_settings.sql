-- Step 12. Copy the 1 auto-renew settings row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_hive_training_auto_renew_settings AS TABLE public.hive_training_auto_renew_settings;
