-- EXEC-PHI batch 5 (host-home records): strip "OR is_hive_executive(auth.uid())" from 7 SELECT policies.
-- Each one was (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid())). RESTORE: append the OR term again.
-- Note: these reads are still open to every member of the org, not limited to caseload. Not an exec issue; listed for follow-up.
ALTER POLICY "members read hhs inventory" ON public.hhs_client_inventories USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs drills" ON public.hhs_evacuation_drills USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs incidents" ON public.hhs_incident_reports USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs medical" ON public.hhs_medical_logs USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs attendance" ON public.hhs_monthly_attendance USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs summary" ON public.hhs_monthly_summaries USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "members read hhs transfers" ON public.hhs_transfer_logs USING ((is_org_member(organization_id, auth.uid())));
