-- Step 37. Drop program courses (15 rows, already backed up).
DROP POLICY IF EXISTS "managers write program courses" ON public.program_courses;
DROP POLICY IF EXISTS "read program courses via program" ON public.program_courses;
DROP TABLE IF EXISTS public.program_courses;
