-- Step 13. Copy the 16 checklist-mapping rows into a backup table before that table is dropped.
CREATE TABLE IF NOT EXISTS public._backup_20260928_training_checklist_mappings AS TABLE public.training_checklist_mappings;
