-- Step 32. Drop quiz attempts (4 rows, already backed up).
DROP POLICY IF EXISTS "managers read attempts" ON public.lesson_quiz_attempts;
DROP POLICY IF EXISTS "user own attempts" ON public.lesson_quiz_attempts;
DROP TABLE IF EXISTS public.lesson_quiz_attempts;
