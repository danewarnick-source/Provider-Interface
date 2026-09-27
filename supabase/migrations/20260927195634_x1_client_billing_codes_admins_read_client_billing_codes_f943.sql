-- X-1: remove Hive exec (is_hive_executive) clause from public.client_billing_codes "Admins read client billing codes".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Admins read client billing codes" ON public.client_billing_codes;

CREATE POLICY "Admins read client billing codes"
  ON public.client_billing_codes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()));
