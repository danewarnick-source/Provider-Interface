-- EXEC-PHI batch 4 (EVV + PBA client funds): strip the exec / super-admin branch from 9 policies. Everything else is unchanged.
-- evv_timesheets read: the is_super_admin(auth.uid()) branch was removed (per Dane). Exec company-list hours going to 0 is a known Lane B follow-up.
-- RESTORE: put back the removed term in each policy. The prior definitions were:
--   evv_timesheets."managers delete evv" DELETE: (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
--   evv_timesheets."own staff, caseload, or admin read evv_timesheets" SELECT: ((staff_id = auth.uid()) OR is_org_admin_or_manager(...) OR is_super_admin(auth.uid()) OR can_access_client_phi(client_id))
--   evv_timesheets."staff update own active evv" UPDATE: ((staff_id = auth.uid()) OR is_org_admin_or_manager(...) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   pba_accounts / pba_audit_samples / pba_transactions: "managers write ..." ALL and "members read ..." SELECT were each
--   (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())), with WITH CHECK on the ALL policies
ALTER POLICY "managers delete evv" ON public.evv_timesheets USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "own staff, caseload, or admin read evv_timesheets" ON public.evv_timesheets USING (((staff_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()) OR can_access_client_phi(client_id)));
ALTER POLICY "staff update own active evv" ON public.evv_timesheets USING (((staff_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK (((staff_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers write pba accts" ON public.pba_accounts USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read pba accts" ON public.pba_accounts USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers write pba audit" ON public.pba_audit_samples USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read pba audit" ON public.pba_audit_samples USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers write pba tx" ON public.pba_transactions USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read pba tx" ON public.pba_transactions USING ((is_org_admin_or_manager(organization_id, auth.uid())));
