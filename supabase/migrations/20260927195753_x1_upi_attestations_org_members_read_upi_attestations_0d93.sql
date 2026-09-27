-- X-1: remove Hive exec (is_hive_executive) clause from public.upi_attestations "org members read upi attestations".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "org members read upi attestations" ON public.upi_attestations;

CREATE POLICY "org members read upi attestations"
  ON public.upi_attestations
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
