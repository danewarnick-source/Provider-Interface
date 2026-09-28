-- Step 45. Drop the old training modules (6 rows, already backed up).
DROP POLICY IF EXISTS "anyone authenticated can read training modules" ON public.training_modules;
DROP TABLE IF EXISTS public.training_modules;
