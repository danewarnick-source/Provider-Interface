-- Step 31. Drop the baseline-training timestamp function now that its trigger is gone.
DROP FUNCTION IF EXISTS public.touch_baseline_training_updated_at();
