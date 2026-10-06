-- Step 54. Drop empty org training orders.
DROP POLICY IF EXISTS "Org admins can insert training orders" ON public.org_training_orders;
DROP POLICY IF EXISTS "Org admins can update training orders" ON public.org_training_orders;
DROP POLICY IF EXISTS "Org members can view training orders" ON public.org_training_orders;
DROP TABLE IF EXISTS public.org_training_orders;
