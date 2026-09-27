-- Emergency contacts (Dane, 9:50 PM MT): every org member could read every client's emergency contacts. Now limited to admin/manager
-- or members with can_access_client_phi(client_id), matching the DB-4/DB-5 pattern.
-- Callers: profile-tab and client-care-data read per client (caseload staff still pass); smart-import-commit; mcp get-client (being deleted in Lane B).
-- PRIOR (after exec batch 2; RESTORE): ALTER POLICY "members read emergency contacts" ON public.client_emergency_contacts USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "members read emergency contacts" ON public.client_emergency_contacts USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id)));
