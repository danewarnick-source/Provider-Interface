-- X-1: remove Hive exec (is_hive_executive) clause from public.client_billing_code_rate_history "Admins read rate history".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Admins read rate history" ON public.client_billing_code_rate_history;

CREATE POLICY "Admins read rate history"
  ON public.client_billing_code_rate_history
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()));
