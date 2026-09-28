-- Step 8. Drop the cycle obligation_instances.evidence_file_id -> file_records.
-- Column public.obligation_instances.evidence_file_id stays until step 33 drops the table.
-- Without this, step 14 cannot drop file_records while obligation_instances still points at it.
ALTER TABLE public.obligation_instances DROP CONSTRAINT obligation_instances_evidence_file_id_fkey;
