-- Step 3. Copy the 364 lesson rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_lessons AS TABLE public.lessons;
