-- Item: DB-26 (Low). Staff could edit/delete import merge flags.
-- Fix: UPDATE and DELETE on import_merge_flags now admin/manager only.
-- DEVIATION from master list: INSERT left at is_org_member. Reason: nectar-documents ingestDocument
--   (requireOrgMembership 'staff') -> applyExtractedFieldsToClient inserts merge flags via the user client;
--   restricting INSERT would silently drop conflict flags for staff uploads (insert errors are swallowed).
-- Callers checked: import-checklist resolveMergeFlag (update) is gated by requireAdminForClient; no src delete caller;
--   smart-import-review reads only.
-- Retest (rolled back): s2 insert=1 (kept), s2 update=0, s2 delete=0, s3 delete=0, s1 update=1, s1 delete=1.
-- Note: SELECT stays org-wide member; flag rows carry existing/incoming client field values (member-level PHI exposure, pre-existing).
-- RESTORE:
-- ALTER POLICY "org members update merge flags" ON public.import_merge_flags USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
-- ALTER POLICY "org members delete merge flags" ON public.import_merge_flags USING (is_org_member(organization_id, auth.uid()));

ALTER POLICY "org members update merge flags" ON public.import_merge_flags USING (is_org_admin_or_manager(organization_id, auth.uid())) WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
ALTER POLICY "org members delete merge flags" ON public.import_merge_flags USING (is_org_admin_or_manager(organization_id, auth.uid()));
