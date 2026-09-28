-- Step 6. Copy hive_training_course_modules (3 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.hive_training_course_modules_backup_20260928b AS SELECT * FROM public.hive_training_course_modules;
ALTER TABLE public.hive_training_course_modules_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hive_training_course_modules_backup_20260928b FROM anon, authenticated;
