-- Step 52. Drop auto-renew settings (1 row, already backed up).
DROP POLICY IF EXISTS "Org admins manage auto-renew settings" ON public.hive_training_auto_renew_settings;
DROP POLICY IF EXISTS "Service role full access auto-renew settings" ON public.hive_training_auto_renew_settings;
DROP TABLE IF EXISTS public.hive_training_auto_renew_settings;
