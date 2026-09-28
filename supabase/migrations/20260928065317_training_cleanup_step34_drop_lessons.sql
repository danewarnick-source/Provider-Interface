-- Step 34. Drop lessons (364 rows, already backed up).
DROP POLICY IF EXISTS "managers write lessons" ON public.lessons;
DROP POLICY IF EXISTS "read lessons via course" ON public.lessons;
DROP TABLE IF EXISTS public.lessons;
