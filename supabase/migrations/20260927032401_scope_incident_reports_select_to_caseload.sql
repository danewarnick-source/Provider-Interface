-- DB-4 (Lane A). Applied live on Hive-Platform as version 20260927032401.
-- "org members read incident reports" let any active org member read every incident in the agency.
-- New scope: reporter, owner/agency-scope admin, same-org member with can_access_client_phi(client_id)
-- (caseload via staff_assignments / access_assignments), or Hive exec (exec branch unchanged from before).
-- Prior USING: (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
ALTER POLICY "org members read incident reports" ON public.incident_reports
USING (reported_by = auth.uid()
    OR public.is_org_admin_or_manager(organization_id, auth.uid())
    OR (public.is_org_member(organization_id, auth.uid()) AND public.can_access_client_phi(client_id))
    OR public.is_hive_executive(auth.uid()));
