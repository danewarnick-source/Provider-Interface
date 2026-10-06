-- Step 1. Copy the 21 course rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_courses AS TABLE public.courses;
