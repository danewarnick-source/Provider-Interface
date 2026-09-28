-- Step 51. Drop empty hive module progress. Course modules and assignments stay.
DROP POLICY IF EXISTS "module progress read" ON public.hive_training_module_progress;
DROP POLICY IF EXISTS "module progress staff write" ON public.hive_training_module_progress;
DROP TABLE IF EXISTS public.hive_training_module_progress;
