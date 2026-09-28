-- Step 7. Drop the foreign key from KEEP table nectar_attestations to nectar_compliance_instances.
-- Column public.nectar_attestations.covers_instance_id stays.
ALTER TABLE public.nectar_attestations DROP CONSTRAINT nectar_attestations_covers_instance_id_fkey;
