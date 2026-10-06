-- EXEC-PHI batch 3 (medication / eMAR): strip "OR is_hive_executive(auth.uid())" from 8 policies. Everything else is unchanged.
-- RESTORE: append " OR is_hive_executive(auth.uid())" inside each USING / WITH CHECK below. The prior definitions were:
--   controlled_med_counts."members read cmc" SELECT: (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
--   emar_log_addenda."members read addenda" SELECT: same shape
--   emar_logs."admin_reviewed flip only" UPDATE: (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   emar_logs."staff update own emar" UPDATE: ((staff_id = auth.uid()) OR is_org_admin_or_manager(...) OR is_hive_executive(auth.uid()))
--   medication_change_proposals."admin or manager insert med proposals" INSERT CHECK: (... AND (is_org_admin_or_manager(...) OR is_hive_executive(auth.uid())))
--   medication_change_proposals."admin update med proposals" UPDATE: (access_is_owner(...) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   medication_change_proposals."members read med proposals" SELECT: (is_org_member(...) OR is_hive_executive(auth.uid()))
--   medication_transfers."members read transfers" SELECT: (is_org_member(...) OR is_hive_executive(auth.uid()))
-- Callers: no exec screen reads these tables.
ALTER POLICY "members read cmc" ON public.controlled_med_counts USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read addenda" ON public.emar_log_addenda USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "admin_reviewed flip only" ON public.emar_logs USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "staff update own emar" ON public.emar_logs USING (((staff_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "admin or manager insert med proposals" ON public.medication_change_proposals WITH CHECK (((proposed_by = auth.uid()) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (applied_medication_id IS NULL) AND (is_org_admin_or_manager(organization_id, auth.uid()))));
ALTER POLICY "admin update med proposals" ON public.medication_change_proposals USING ((access_is_owner(organization_id, auth.uid()))) WITH CHECK ((access_is_owner(organization_id, auth.uid())));
ALTER POLICY "members read med proposals" ON public.medication_change_proposals USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read transfers" ON public.medication_transfers USING ((is_org_member(organization_id, auth.uid())));
