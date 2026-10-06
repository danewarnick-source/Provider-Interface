-- Step 22. Remove the updated-at trigger on the baseline training table before that table is dropped.
DROP TRIGGER IF EXISTS trg_touch_baseline_training_updated_at ON public.staff_baseline_training_completions;
