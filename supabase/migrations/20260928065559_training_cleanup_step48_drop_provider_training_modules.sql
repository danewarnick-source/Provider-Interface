-- Step 48. Drop empty provider training modules.
DROP POLICY IF EXISTS "admins manage org training content" ON public.provider_training_modules;
DROP POLICY IF EXISTS "staff read published person modules if assigned" ON public.provider_training_modules;
DROP POLICY IF EXISTS "staff read published policies" ON public.provider_training_modules;
DROP TABLE IF EXISTS public.provider_training_modules;
