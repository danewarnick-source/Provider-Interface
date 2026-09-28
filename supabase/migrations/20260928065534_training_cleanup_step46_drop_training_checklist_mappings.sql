-- Step 46. Drop checklist mappings (16 rows, already backed up). staff_checklist_completion stays.
DROP POLICY IF EXISTS "authenticated read training_checklist_mappings" ON public.training_checklist_mappings;
DROP POLICY IF EXISTS "hive exec manage training_checklist_mappings" ON public.training_checklist_mappings;
DROP TABLE IF EXISTS public.training_checklist_mappings;
