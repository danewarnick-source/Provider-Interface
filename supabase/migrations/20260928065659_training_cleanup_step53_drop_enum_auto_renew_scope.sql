-- Step 53. Drop the auto-renew scope enum. Only the settings table used it.
DROP TYPE IF EXISTS public.hive_training_auto_renew_scope;
