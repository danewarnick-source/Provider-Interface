-- Step 33. Parent of attestations, file_records, obligation_instance_assignees, and reviews.
-- requirement_def_id still points at requirement_defs, so this drops before step 34.
DROP TABLE public.obligation_instances;
