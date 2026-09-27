-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_completions "org members read obligation completions".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read obligation completions" ON public.company_obligation_completions;

CREATE POLICY "org members read obligation completions"
  ON public.company_obligation_completions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
