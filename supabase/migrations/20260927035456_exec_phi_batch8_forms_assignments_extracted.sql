-- EXEC-PHI batch 8: strip "OR is_hive_executive(auth.uid())" from 8 policies on
-- submitted_forms (3), staff_assignments (2), shift_completeness_flags (1) and nectar_extracted_fields (2).
-- The prior definition of each is the statement below with " OR is_hive_executive(auth.uid())" appended inside USING / WITH CHECK. RESTORE the same way.
ALTER POLICY "managers delete submitted forms" ON public.submitted_forms USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers update submitted forms" ON public.submitted_forms USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "users read own or managers org submitted forms" ON public.submitted_forms USING (((user_id = auth.uid()) OR is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers write staff assignments" ON public.staff_assignments USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read staff assignments" ON public.staff_assignments USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "admins resolve completeness flags" ON public.shift_completeness_flags USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "admins manage extracted fields" ON public.nectar_extracted_fields USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "org members read extracted fields" ON public.nectar_extracted_fields USING ((is_org_member(organization_id, auth.uid())));
