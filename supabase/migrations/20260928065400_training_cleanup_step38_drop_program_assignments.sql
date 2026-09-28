-- Step 38. Drop program assignments (empty).
DROP POLICY IF EXISTS "managers assign programs" ON public.program_assignments;
DROP POLICY IF EXISTS "managers delete program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "user reads own program assignment" ON public.program_assignments;
DROP POLICY IF EXISTS "user updates own program assignment" ON public.program_assignments;
DROP TABLE IF EXISTS public.program_assignments;
