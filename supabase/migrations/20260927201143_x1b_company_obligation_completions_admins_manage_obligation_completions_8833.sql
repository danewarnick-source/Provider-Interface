-- X-1b: remove Hive exec (is_hive_executive) clause on public.company_obligation_completions "admins manage obligation completions".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage obligation completions" ON public.company_obligation_completions;

CREATE POLICY "admins manage obligation completions"
  ON public.company_obligation_completions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
