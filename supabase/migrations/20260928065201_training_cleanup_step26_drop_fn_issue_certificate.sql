-- Step 26. Drop the old certificate-issue function. The in-platform course prints its own certificate and does not use this.
DROP FUNCTION IF EXISTS public.issue_certificate_on_completion();
