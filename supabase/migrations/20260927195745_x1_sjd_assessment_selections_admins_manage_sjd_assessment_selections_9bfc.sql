-- X-1: remove Hive exec (is_hive_executive) clause from public.sjd_assessment_selections "admins manage sjd assessment selections".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage sjd assessment selections" ON public.sjd_assessment_selections;

CREATE POLICY "admins manage sjd assessment selections"
  ON public.sjd_assessment_selections
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
