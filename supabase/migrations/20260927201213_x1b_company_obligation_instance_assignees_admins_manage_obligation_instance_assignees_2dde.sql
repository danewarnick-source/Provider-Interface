-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_instance_assignees "admins manage obligation instance assignees".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage obligation instance assignees" ON public.company_obligation_instance_assignees;

CREATE POLICY "admins manage obligation instance assignees"
  ON public.company_obligation_instance_assignees
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
