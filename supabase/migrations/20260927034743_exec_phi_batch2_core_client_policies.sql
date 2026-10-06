-- EXEC-PHI batch 2: remove the "OR is_hive_executive(auth.uid())" branch from the core client PHI policies. Every other predicate is unchanged.
-- Tables: clients, client_documents, client_medications, client_emergency_contacts, daily_logs, incident_reports (including the DB-4 select policy).
-- RESTORE: re-run each ALTER POLICY below with "OR is_hive_executive(auth.uid())" appended to USING (and to WITH CHECK where one is present). The prior definitions were:
--   clients."managers write clients" ALL: (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   client_documents."admins manage documents" ALL: same as above
--   client_medications."admins write meds" ALL: (access_is_owner(organization_id, auth.uid()) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   client_emergency_contacts."managers write emergency contacts" ALL: (is_org_admin_or_manager(...) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   client_emergency_contacts."members read emergency contacts" SELECT: (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
--   daily_logs."admins approve daily logs" UPDATE: ((user_id = auth.uid()) OR is_org_admin_or_manager(...) OR is_hive_executive(auth.uid())) for both USING and CHECK
--   daily_logs."managers delete daily logs" DELETE: (is_org_admin_or_manager(...) OR is_hive_executive(auth.uid()))
--   daily_logs."org members read daily logs" / "users read own daily logs" SELECT: ((user_id = auth.uid()) OR is_org_admin_or_manager(...) OR is_hive_executive(auth.uid()))
--   incident_reports."admins update incident reports" UPDATE: ((reported_by = auth.uid()) OR is_org_admin_or_manager(...) OR is_hive_executive(auth.uid()))
--   incident_reports."org members read incident reports" SELECT: ((reported_by = auth.uid()) OR is_org_admin_or_manager(...) OR (is_org_member(...) AND can_access_client_phi(client_id)) OR is_hive_executive(auth.uid()))
-- Callers: the exec screens (dashboard.hive-exec.*) do not read these tables except for client COUNTS in hive-exec.functions listCompanies/getCompanyDetail,
-- and the smart-import dedup read of clients. Both are listed for Lane B. Exec company creation and seeding use supabaseAdmin, so they are unaffected.
ALTER POLICY "managers write clients" ON public.clients USING (is_org_admin_or_manager(organization_id, auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "admins manage documents" ON public.client_documents USING (is_org_admin_or_manager(organization_id, auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "admins write meds" ON public.client_medications USING (access_is_owner(organization_id, auth.uid())) WITH CHECK (access_is_owner(organization_id, auth.uid()));
ALTER POLICY "managers write emergency contacts" ON public.client_emergency_contacts USING (is_org_admin_or_manager(organization_id, auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "members read emergency contacts" ON public.client_emergency_contacts USING (is_org_member(organization_id, auth.uid()));
ALTER POLICY "admins approve daily logs" ON public.daily_logs USING ((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid())) WITH CHECK ((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "managers delete daily logs" ON public.daily_logs USING (is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "org members read daily logs" ON public.daily_logs USING ((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "users read own daily logs" ON public.daily_logs USING ((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "admins update incident reports" ON public.incident_reports USING ((reported_by = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "org members read incident reports" ON public.incident_reports USING ((reported_by = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid()) OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id)));
