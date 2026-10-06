-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligations "admins manage company obligations".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage company obligations" ON public.company_obligations;

CREATE POLICY "admins manage company obligations"
  ON public.company_obligations
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
