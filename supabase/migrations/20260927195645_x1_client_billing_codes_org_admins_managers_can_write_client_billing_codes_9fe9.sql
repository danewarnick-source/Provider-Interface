-- X-1: remove Hive exec (is_hive_executive) clause from public.client_billing_codes "Org admins/managers can write client billing codes".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Org admins/managers can write client billing codes" ON public.client_billing_codes;

CREATE POLICY "Org admins/managers can write client billing codes"
  ON public.client_billing_codes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
