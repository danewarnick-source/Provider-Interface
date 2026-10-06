-- Step 57. Drop empty external certifications. Evidence holds licenses and certificates now.
DROP POLICY IF EXISTS "user deletes own pending ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user reads own ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user updates own pending ext certs" ON public.external_certifications;
DROP POLICY IF EXISTS "user uploads own ext certs" ON public.external_certifications;
DROP TABLE IF EXISTS public.external_certifications;
