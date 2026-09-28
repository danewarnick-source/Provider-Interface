-- Step 7. Copy the 15 program-course rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_program_courses AS TABLE public.program_courses;
