-- Step 11. Drop the immutability trigger on nectar_requirement_usage, then its function.
DROP TRIGGER trg_nectar_usage_no_update ON public.nectar_requirement_usage;
DROP FUNCTION public.nectar_requirement_usage_immutable();
