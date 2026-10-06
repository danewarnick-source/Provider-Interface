-- EXEC-PHI batch 6 (client-linked records): strip "OR is_hive_executive(auth.uid())" from 9 policies on
-- client_approved_locations, client_belongings, custom_field_values, hhs_host_home_monthly and hhs_host_home_settings.
-- The host-home tables are per client, with amounts and notes.
-- Prior definitions were (base predicate OR is_hive_executive(auth.uid())), where the base is
-- is_org_admin_or_manager(organization_id, auth.uid()) for the admin/manager policies and is_org_member(...) for the two "members read" policies.
-- RESTORE: append the OR term again (in WITH CHECK too, for the ALL policies).
ALTER POLICY "admins write approved locations" ON public.client_approved_locations USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "managers write belongings" ON public.client_belongings USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read belongings" ON public.client_belongings USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "managers write cfv" ON public.custom_field_values USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "members read cfv" ON public.custom_field_values USING ((is_org_member(organization_id, auth.uid())));
ALTER POLICY "hhs_host_monthly admins read" ON public.hhs_host_home_monthly USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "hhs_host_monthly admins write" ON public.hhs_host_home_monthly USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "hhs_host_settings admins read" ON public.hhs_host_home_settings USING ((is_org_admin_or_manager(organization_id, auth.uid())));
ALTER POLICY "hhs_host_settings admins write" ON public.hhs_host_home_settings USING ((is_org_admin_or_manager(organization_id, auth.uid()))) WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid())));
