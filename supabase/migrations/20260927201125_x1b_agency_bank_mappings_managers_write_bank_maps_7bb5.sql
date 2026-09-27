-- X-1b: remove Hive exec (is_hive_executive) clause on public.agency_bank_mappings "managers write bank maps".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "managers write bank maps" ON public.agency_bank_mappings;

CREATE POLICY "managers write bank maps"
  ON public.agency_bank_mappings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
