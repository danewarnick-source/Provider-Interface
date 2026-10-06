-- Step 47. Drop training topics (22 rows, already backed up).
DROP POLICY IF EXISTS "anyone authenticated reads training topics" ON public.training_topics;
DROP TABLE IF EXISTS public.training_topics;
