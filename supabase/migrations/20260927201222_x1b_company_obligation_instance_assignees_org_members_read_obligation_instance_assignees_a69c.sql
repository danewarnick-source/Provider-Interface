-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_instance_assignees "org members read obligation instance assignees".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read obligation instance assignees" ON public.company_obligation_instance_assignees;

CREATE POLICY "org members read obligation instance assignees"
  ON public.company_obligation_instance_assignees
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
