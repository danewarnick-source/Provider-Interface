-- X-1: remove Hive exec (is_hive_executive) clause from public.client_billing_code_rate_history "Admins write rate history".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Admins write rate history" ON public.client_billing_code_rate_history;

CREATE POLICY "Admins write rate history"
  ON public.client_billing_code_rate_history
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()));
