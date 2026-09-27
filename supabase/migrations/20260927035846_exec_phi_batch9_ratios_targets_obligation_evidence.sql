-- Item: exec-PHI batch 9 (Lane A, Dane decision 9:58 PM MT 2026-09-26)
-- Fixes: removes `OR is_hive_executive(auth.uid())` from client_ratios, client_weekly_targets,
--   and the 4 obligation-evidence storage policies (bucket holds evidence for
--   company_obligation_instances, which carry client_id -> PHI-bearing).
-- Kept: message-attachments exec policies (exec messaging, non-PHI); agency-policies bucket (company docs).
-- Callers checked: src org flows only (org admin/member via requireOrgMembership, no exec override).
-- Retest (rolled back): evidence read s1(owner A)=both objs, s2=own only, s3=none, execX=none, d672=none;
--   execX upload=42501, s2 upload ok, execX delete=0 rows, s1 delete ok. Tables: 0 rows exist; exec reads 0.
-- RESTORE (prior definitions):
-- ALTER POLICY "admins write client_ratios" ON public.client_ratios USING (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- ALTER POLICY "org members read client_ratios" ON public.client_ratios USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- ALTER POLICY "admins write weekly targets" ON public.client_weekly_targets USING (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- ALTER POLICY "org members read weekly targets" ON public.client_weekly_targets USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- ALTER POLICY "obligation evidence delete admins" ON storage.objects USING (bucket_id = 'obligation-evidence' AND (is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR is_hive_executive(auth.uid())));
-- ALTER POLICY "obligation evidence insert org members" ON storage.objects WITH CHECK (bucket_id = 'obligation-evidence' AND (is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()) OR is_hive_executive(auth.uid())));
-- ALTER POLICY "obligation evidence select org members" ON storage.objects USING (bucket_id = 'obligation-evidence' AND (is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR is_hive_executive(auth.uid()) OR owner = auth.uid()));
-- ALTER POLICY "obligation evidence update admins" ON storage.objects USING (bucket_id = 'obligation-evidence' AND (is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR is_hive_executive(auth.uid())));

ALTER POLICY "admins write client_ratios" ON public.client_ratios USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "org members read client_ratios" ON public.client_ratios USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "admins write weekly targets" ON public.client_weekly_targets USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "org members read weekly targets" ON public.client_weekly_targets USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "obligation evidence delete admins" ON storage.objects USING (((bucket_id = 'obligation-evidence'::text) AND is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid())));
ALTER POLICY "obligation evidence insert org members" ON storage.objects WITH CHECK (((bucket_id = 'obligation-evidence'::text) AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())));
ALTER POLICY "obligation evidence select org members" ON storage.objects USING (((bucket_id = 'obligation-evidence'::text) AND (is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid()) OR (owner = auth.uid()))));
ALTER POLICY "obligation evidence update admins" ON storage.objects USING (((bucket_id = 'obligation-evidence'::text) AND is_org_admin_or_manager(((storage.foldername(name))[1])::uuid, auth.uid())));
