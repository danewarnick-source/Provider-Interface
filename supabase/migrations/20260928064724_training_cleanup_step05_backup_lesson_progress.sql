-- Step 5. Copy the 1 lesson-progress row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lesson_progress AS TABLE public.lesson_progress;
