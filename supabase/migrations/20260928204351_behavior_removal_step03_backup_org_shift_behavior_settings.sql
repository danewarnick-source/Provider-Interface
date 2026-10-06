-- Step 3. Copy the 1 org_shift_behavior_settings row. The live table stays
-- (step 16). This backup is the copy of the behavior toggle plus the
-- scheduling columns, taken before enabled is removed.
CREATE TABLE IF NOT EXISTS public.org_shift_behavior_settings_backup_20260928c
AS SELECT * FROM public.org_shift_behavior_settings;
