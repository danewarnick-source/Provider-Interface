-- Step 8. Drop bc_data_entries first. It is the only child inside the set
-- (behavior_id -> bc_behaviors). No CASCADE.
DROP TABLE IF EXISTS public.bc_data_entries;
