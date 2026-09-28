-- Step 42. Drop training programs (4 rows, already backed up).
DROP POLICY IF EXISTS "managers write programs" ON public.training_programs;
DROP POLICY IF EXISTS "members read programs" ON public.training_programs;
DROP POLICY IF EXISTS "super admins write programs" ON public.training_programs;
DROP TABLE IF EXISTS public.training_programs;
