-- Step 41. Drop the old courses table (21 rows, already backed up).
DROP POLICY IF EXISTS "managers write courses" ON public.courses;
DROP POLICY IF EXISTS "members read courses" ON public.courses;
DROP TABLE IF EXISTS public.courses;
