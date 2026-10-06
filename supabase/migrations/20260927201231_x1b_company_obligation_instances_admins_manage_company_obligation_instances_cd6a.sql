-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_instances "admins manage company obligation instances".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage company obligation instances" ON public.company_obligation_instances;

CREATE POLICY "admins manage company obligation instances"
  ON public.company_obligation_instances
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
