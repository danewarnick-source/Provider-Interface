-- Step 36. Drop program acknowledgements (empty).
DROP POLICY IF EXISTS "managers read acks" ON public.program_acknowledgements;
DROP POLICY IF EXISTS "user own acks" ON public.program_acknowledgements;
DROP TABLE IF EXISTS public.program_acknowledgements;
