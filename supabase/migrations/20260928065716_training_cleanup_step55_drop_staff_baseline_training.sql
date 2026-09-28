-- Step 55. Drop empty baseline training completions. Evidence is the record now.
DROP POLICY IF EXISTS "baseline self attestation write" ON public.staff_baseline_training_completions;
DROP POLICY IF EXISTS "baseline training view" ON public.staff_baseline_training_completions;
DROP POLICY IF EXISTS "baseline training write" ON public.staff_baseline_training_completions;
DROP TABLE IF EXISTS public.staff_baseline_training_completions;
