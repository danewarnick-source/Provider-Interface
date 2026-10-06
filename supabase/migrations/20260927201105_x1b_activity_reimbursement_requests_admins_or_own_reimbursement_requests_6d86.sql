-- X-1b: add org-membership guard to the staff_id = auth.uid() branch on public.activity_reimbursement_requests "Admins or own reimbursement requests".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Admins or own reimbursement requests" ON public.activity_reimbursement_requests;

CREATE POLICY "Admins or own reimbursement requests"
  ON public.activity_reimbursement_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_admin_or_manager(organization_id, auth.uid()) OR ((staff_id = auth.uid()) AND is_org_member(organization_id, auth.uid()))));
