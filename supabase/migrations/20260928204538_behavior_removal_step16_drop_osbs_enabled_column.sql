-- Step 16. Remove the unused behavior toggle from the scheduling settings
-- table. Do not drop the table, its policies, its updated-at trigger, or
-- rule_settings / ot_threshold_hours.
ALTER TABLE public.org_shift_behavior_settings
  DROP COLUMN IF EXISTS enabled;
