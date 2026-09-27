-- Host-home record reads (Dane, 9:54 PM MT): the 7 hhs_* read policies were org-wide for any member. Now: admin/manager, OR
-- (member AND (provider_id = auth.uid() OR can_access_client_phi(client_id))).
-- provider_id = self (the record's author) was added, like DB-4's reported_by. It keeps the attendance upsert (onConflict client_id,record_date)
-- and "my entries" working if a provider's caseload changes.
-- Precheck: all 7 tables have client_id NOT NULL. The src staff paths (hhs.functions list*/save*, hhs-certifications) query by org or client and let
-- RLS narrow the rows. No flow is keyed by home or staff alone, so none was left out. agency-health reads org-wide as admin (admins keep full access).
-- The tables currently have 0 live rows, so no user loses existing access.
-- PRIOR (after exec batch 5; RESTORE): each was USING ((is_org_member(organization_id, auth.uid()))).
ALTER POLICY "members read hhs inventory" ON public.hhs_client_inventories USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs drills" ON public.hhs_evacuation_drills USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs incidents" ON public.hhs_incident_reports USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs medical" ON public.hhs_medical_logs USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs attendance" ON public.hhs_monthly_attendance USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs summary" ON public.hhs_monthly_summaries USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
ALTER POLICY "members read hhs transfers" ON public.hhs_transfer_logs USING (is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND (provider_id = auth.uid() OR can_access_client_phi(client_id))));
