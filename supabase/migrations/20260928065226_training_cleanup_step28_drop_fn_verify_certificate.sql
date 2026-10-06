-- Step 28. Drop the public certificate lookup used by /verify. The in-platform course does not call it.
DROP FUNCTION IF EXISTS public.verify_certificate(text);
