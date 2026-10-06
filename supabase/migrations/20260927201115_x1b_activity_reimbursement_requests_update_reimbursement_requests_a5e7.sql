-- X-1b: add org-membership guard to the staff_id = auth.uid() branch (USING and WITH CHECK) on public.activity_reimbursement_requests "Update reimbursement requests".
-- Same name, command, roles and remaining org logic.

DROP POLICY IF EXISTS "Update reimbursement requests" ON public.activity_reimbursement_requests;

CREATE POLICY "Update reimbursement requests"
  ON public.activity_reimbursement_requests
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((is_org_admin_or_manager(organization_id, auth.uid()) OR ((staff_id = auth.uid()) AND is_org_member(organization_id, auth.uid()))))
  WITH CHECK ((is_org_admin_or_manager(organization_id, auth.uid()) OR ((staff_id = auth.uid()) AND is_org_member(organization_id, auth.uid()))));
