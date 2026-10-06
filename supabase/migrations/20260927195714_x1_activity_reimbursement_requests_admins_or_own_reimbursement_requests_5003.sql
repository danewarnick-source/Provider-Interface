-- X-1: remove Hive exec (is_hive_executive) clause from public.activity_reimbursement_requests "Admins or own reimbursement requests".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Admins or own reimbursement requests" ON public.activity_reimbursement_requests;

CREATE POLICY "Admins or own reimbursement requests"
  ON public.activity_reimbursement_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_admin_or_manager(organization_id, auth.uid()) OR (staff_id = auth.uid())));
