-- Step 21. Stop in-platform course completions from auto-checking the HR checklist. The checklist table itself stays.
DROP TRIGGER IF EXISTS trg_auto_check_hr_from_training ON public.training_completions;
