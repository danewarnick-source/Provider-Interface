-- Item: DB-32 (verify -> REPRODUCED). Every select on audit_packages / audit_package_access / _subjects / _folders / _files
--   raised 42P17 "infinite recursion detected in policy" for s1, s2 and s3 (all 5 tables had 0 rows).
-- Cause: audit_packages "auditors read granted packages" -> EXISTS audit_package_access -> "org admins manage access"
--   -> EXISTS audit_packages -> loop. Other tables all pass through audit_packages.
-- Fix: new SECURITY DEFINER lookup public.audit_package_org_id(uuid) (execute: authenticated, service_role; revoked from PUBLIC/anon)
--   used in the access-table admin policy, which breaks the cycle.
-- Also fixed: "auditors read granted package subjects" never tied to the row's package (p.id = apa.audit_package_id was redundant),
--   so an auditor with access to any one package would see subjects of all packages in all orgs. Added p.id = audit_package_subjects.audit_package_id.
-- Retest (rolled back; packages in A and B, sec4 temporarily an active auditor granted package A):
--   no errors; s1 sees A only on all tables; s3 sees B only; s2=0; exec X=0; auditor sees package A, its access row, A subjects only (not B), A folder.
--   s1 grant on A passes RLS (23505 duplicate); s2/s3 grant=42501; s1 revoke=1; anon execute on helper=false.
-- RESTORE:
-- ALTER POLICY "org admins manage access" ON public.audit_package_access USING (EXISTS (SELECT 1 FROM audit_packages p WHERE ((p.id = audit_package_access.audit_package_id) AND is_org_admin_or_manager(p.organization_id, auth.uid())))) WITH CHECK (EXISTS (SELECT 1 FROM audit_packages p WHERE ((p.id = audit_package_access.audit_package_id) AND is_org_admin_or_manager(p.organization_id, auth.uid()))));
-- ALTER POLICY "auditors read granted package subjects" ON public.audit_package_subjects USING (EXISTS (SELECT 1 FROM ((audit_packages p JOIN audit_package_access apa ON ((apa.audit_package_id = p.id))) JOIN auditor_accounts aa ON ((aa.id = apa.auditor_account_id))) WHERE ((p.id = apa.audit_package_id) AND (p.status = ANY (ARRAY['released'::text, 'closed'::text])) AND (apa.revoked_at IS NULL) AND (aa.user_id = auth.uid()) AND (aa.status = 'active'::text))));
-- DROP FUNCTION public.audit_package_org_id(uuid);

CREATE FUNCTION public.audit_package_org_id(_pkg uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT organization_id FROM public.audit_packages WHERE id = _pkg $function$;
REVOKE ALL ON FUNCTION public.audit_package_org_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_package_org_id(uuid) TO authenticated, service_role;

ALTER POLICY "org admins manage access" ON public.audit_package_access
  USING (is_org_admin_or_manager(public.audit_package_org_id(audit_package_id), auth.uid()))
  WITH CHECK (is_org_admin_or_manager(public.audit_package_org_id(audit_package_id), auth.uid()));

ALTER POLICY "auditors read granted package subjects" ON public.audit_package_subjects
  USING (EXISTS (SELECT 1 FROM ((audit_packages p JOIN audit_package_access apa ON ((apa.audit_package_id = p.id))) JOIN auditor_accounts aa ON ((aa.id = apa.auditor_account_id)))
    WHERE ((p.id = audit_package_subjects.audit_package_id) AND (p.status = ANY (ARRAY['released'::text, 'closed'::text])) AND (apa.revoked_at IS NULL) AND (aa.user_id = auth.uid()) AND (aa.status = 'active'::text))));
