-- Step 50. Drop empty hive training certificates. Class seats and assignments stay.
DROP POLICY IF EXISTS "certs insert for own assignment" ON public.hive_training_certificates;
DROP POLICY IF EXISTS "certs read own or org" ON public.hive_training_certificates;
DROP TABLE IF EXISTS public.hive_training_certificates;
