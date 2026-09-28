-- Step 56. Drop empty training runs.
DROP POLICY IF EXISTS "training_runs_select_member" ON public.training_runs;
DROP POLICY IF EXISTS "training_runs_write_admin" ON public.training_runs;
DROP TABLE IF EXISTS public.training_runs;
