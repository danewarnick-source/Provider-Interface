-- Step 39. Drop course assignments (1 row, already backed up).
DROP POLICY IF EXISTS "managers assign" ON public.course_assignments;
DROP POLICY IF EXISTS "managers delete assign" ON public.course_assignments;
DROP POLICY IF EXISTS "super admins read all assignments" ON public.course_assignments;
DROP POLICY IF EXISTS "user reads own" ON public.course_assignments;
DROP POLICY IF EXISTS "user updates own progress" ON public.course_assignments;
DROP TABLE IF EXISTS public.course_assignments;
