-- X-1b: remove Hive exec (is_hive_executive) clause on public.agency_bank_mappings "members read bank maps".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "members read bank maps" ON public.agency_bank_mappings;

CREATE POLICY "members read bank maps"
  ON public.agency_bank_mappings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()));
