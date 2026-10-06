-- Step 4. Copy the 1 course-assignment row into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_course_assignments AS TABLE public.course_assignments;
