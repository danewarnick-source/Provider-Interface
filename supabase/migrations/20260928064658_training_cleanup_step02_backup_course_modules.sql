-- Step 2. Copy the 76 course-module rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_course_modules AS TABLE public.course_modules;
