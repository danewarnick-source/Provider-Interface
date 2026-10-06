-- Step 29. Drop the second public certificate lookup. Same reason as step 28.
DROP FUNCTION IF EXISTS public.verify_certification(text);
