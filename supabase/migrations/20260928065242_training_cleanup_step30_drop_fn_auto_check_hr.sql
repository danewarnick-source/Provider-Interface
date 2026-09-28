-- Step 30. Drop the HR auto-check function now that its trigger is gone.
DROP FUNCTION IF EXISTS public.auto_check_hr_from_training();
