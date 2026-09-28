-- Step 5. Drop the behavior-only trigger and its function. Leave
-- update_updated_at_column in place.
DROP TRIGGER IF EXISTS trg_bc_touch_last_logged ON public.bc_data_entries;
DROP FUNCTION IF EXISTS public.bc_touch_behavior_last_logged();
