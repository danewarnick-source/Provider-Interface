-- Step 44. Drop per-user progress on the old training modules (7 rows, already backed up).
DROP POLICY IF EXISTS "managers assign training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "managers read training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "managers update training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "org admins read member training progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users delete own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users insert own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users read own progress" ON public.user_training_progress;
DROP POLICY IF EXISTS "users update own progress" ON public.user_training_progress;
DROP TABLE IF EXISTS public.user_training_progress;
