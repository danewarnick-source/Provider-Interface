-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_instances "org members read company obligation instances".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read company obligation instances" ON public.company_obligation_instances;

CREATE POLICY "org members read company obligation instances"
  ON public.company_obligation_instances
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
