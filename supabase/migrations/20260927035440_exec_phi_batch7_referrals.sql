-- EXEC-PHI batch 7 (referrals): strip "OR is_hive_executive(auth.uid())" from 6 policies, plus find_possible_duplicate_referral,
-- which returns referral first_name and age (PHI).
-- Prior definitions: each policy was (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())), in USING and/or WITH CHECK.
-- The function's prior guard: AND (auth.uid() IS NULL OR public.is_org_member(_organization_id, auth.uid()) OR public.is_hive_executive(auth.uid()))
-- (full prior body: see DB-11 migration 20260927033005). The function was edited with pg_get_functiondef + regexp_replace;
-- the signature, SECURITY DEFINER, search_path and ACL are unchanged.
-- Left alone (they don't return PHI): get_referral_pipeline_stats (stage counts), archive_eligible_referrals / purge_aged_referrals (they return an int).
-- RESTORE: append the OR term again, and re-run the DB-11 function definition.
ALTER POLICY "ref-activities managers insert" ON public.referral_activities WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "ref-activities managers read" ON public.referral_activities USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "referrals managers delete" ON public.referrals USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "referrals managers insert" ON public.referrals WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "referrals managers read" ON public.referrals USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "referrals managers update" ON public.referrals USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
DO $$
DECLARE f regprocedure := 'public.find_possible_duplicate_referral(uuid,text,integer,uuid)'::regprocedure; d text; nd text;
BEGIN
  d := pg_get_functiondef(f);
  nd := regexp_replace(d, '\s*OR public\.is_hive_executive\(auth\.uid\(\)\)', '', 'g');
  IF nd = d THEN RAISE EXCEPTION 'exec branch not found'; END IF;
  EXECUTE nd;
END $$;
