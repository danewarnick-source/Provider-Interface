-- Lane B item 1 (Dane-approved via Tony 2026-09-27): incident read policy also honours additional_client_ids.
-- Purpose: a staff member with PHI access to any client listed in additional_client_ids (multi-client incident)
--   can read the incident, not only when the primary client_id is on their caseload. Still gated by org membership.
-- Prechecks: can_access_client_phi(uuid), is_org_admin_or_manager(uuid,uuid), is_org_member(uuid,uuid) exist (SECURITY DEFINER);
--   additional_client_ids is uuid[]; 0 existing rows had a non-empty additional_client_ids at apply time.
-- Retest (rolled back; org A incidents reported by sec1, client_id = Test Client Two, not on sec2's caseload):
--   with additional_client_ids = {Test Client One}: sec1=1, sec2=1, sec3=0, sec4=0, exec X=0
--   without additional ids:                          sec1=1, sec2=0, sec3=0, sec4=0, exec X=0
-- ROLLBACK (prior USING expression, captured before apply):
-- ALTER POLICY "org members read incident reports" ON public.incident_reports USING (((reported_by = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id))));

ALTER POLICY "org members read incident reports" ON public.incident_reports USING (reported_by = auth.uid() OR public.is_org_admin_or_manager(organization_id, auth.uid()) OR (public.is_org_member(organization_id, auth.uid()) AND (public.can_access_client_phi(client_id) OR EXISTS (SELECT 1 FROM unnest(COALESCE(additional_client_ids, '{}'::uuid[])) AS extra(client_id) WHERE public.can_access_client_phi(extra.client_id)))));
