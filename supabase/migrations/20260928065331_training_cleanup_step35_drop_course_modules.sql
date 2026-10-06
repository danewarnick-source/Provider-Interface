-- Step 35. Drop course modules (76 rows, already backed up).
DROP POLICY IF EXISTS "managers write modules" ON public.course_modules;
DROP POLICY IF EXISTS "read modules via course" ON public.course_modules;
DROP TABLE IF EXISTS public.course_modules;
