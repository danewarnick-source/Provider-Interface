-- Step 33. Drop lesson progress (1 row, already backed up).
DROP POLICY IF EXISTS "user reads own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "user writes own lesson progress" ON public.lesson_progress;
DROP TABLE IF EXISTS public.lesson_progress;
