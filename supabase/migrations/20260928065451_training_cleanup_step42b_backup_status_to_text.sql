-- Step 42b. Convert the backup status column to text so the assignment_status enum can be dropped in step 43.
ALTER TABLE public._backup_20260928_course_assignments ALTER COLUMN status TYPE text USING status::text;
