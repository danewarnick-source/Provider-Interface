-- X-1: remove Hive exec (is_hive_executive) clause from public.upi_attestations "admins manage upi attestations".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "admins manage upi attestations" ON public.upi_attestations;

CREATE POLICY "admins manage upi attestations"
  ON public.upi_attestations
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
