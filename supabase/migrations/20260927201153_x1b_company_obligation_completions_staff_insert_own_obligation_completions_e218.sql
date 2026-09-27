-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_completions "staff insert own obligation completions".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "staff insert own obligation completions" ON public.company_obligation_completions;

CREATE POLICY "staff insert own obligation completions"
  ON public.company_obligation_completions
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((staff_id = auth.uid()) AND is_org_member(organization_id, auth.uid())));
