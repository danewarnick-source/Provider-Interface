-- Step 6. Copy the 4 quiz-attempt rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lesson_quiz_attempts AS TABLE public.lesson_quiz_attempts;
