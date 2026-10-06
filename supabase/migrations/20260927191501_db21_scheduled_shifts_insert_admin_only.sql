-- DB-21 follow-up: restrict INSERT on public.scheduled_shifts to org admins.
-- Uses the same predicate as the DB-21 DELETE policy ("Org members can delete shifts")
-- and the admin branch of the UPDATE policy: is_org_admin_or_manager(organization_id, auth.uid())
-- (owner, or admin with agency scope). SELECT/UPDATE/DELETE unchanged.
-- Server-side inserts via service role / SECURITY DEFINER are unaffected by RLS.

DROP POLICY IF EXISTS "Org members can insert shifts" ON public.scheduled_shifts;

CREATE POLICY "Org admins can insert shifts"
  ON public.scheduled_shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin_or_manager(organization_id, auth.uid()));
