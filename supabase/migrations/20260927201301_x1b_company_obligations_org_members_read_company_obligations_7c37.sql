-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligations "org members read company obligations".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read company obligations" ON public.company_obligations;

CREATE POLICY "org members read company obligations"
  ON public.company_obligations
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
