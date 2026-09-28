-- Step 10. Drop the immutability trigger on nectar_requirement_category_history, then its function.
DROP TRIGGER trg_nectar_cat_hist_no_update ON public.nectar_requirement_category_history;
DROP FUNCTION public.nectar_req_cat_hist_immutable();
