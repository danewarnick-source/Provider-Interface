-- Step 49. Drop empty person-specific training modules.
DROP POLICY IF EXISTS "managers manage person modules delete" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers manage person modules insert" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers manage person modules update" ON public.training_person_modules;
DROP POLICY IF EXISTS "managers read org person modules" ON public.training_person_modules;
DROP POLICY IF EXISTS "staff read own person modules" ON public.training_person_modules;
DROP TABLE IF EXISTS public.training_person_modules;
