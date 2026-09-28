-- Step 40. Drop old certifications (backed up in step 9, including when the table is empty).
DROP POLICY IF EXISTS "org admins delete certs" ON public.certifications;
DROP POLICY IF EXISTS "org admins manage certs" ON public.certifications;
DROP POLICY IF EXISTS "org members read certs" ON public.certifications;
DROP POLICY IF EXISTS "system issues cert" ON public.certifications;
DROP TABLE IF EXISTS public.certifications;
