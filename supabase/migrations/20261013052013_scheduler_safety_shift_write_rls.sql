-- Scheduler S1: scheduled_shifts write policies only admitted owners / agency-wide admins.
-- A manager with `scheduling` edit access (access_has_category) can now write;
-- scoped managers only for clients they can see. Replaced in place with ALTER POLICY.

ALTER POLICY "Org admins can insert shifts" ON public.scheduled_shifts
  WITH CHECK (public.access_can_write_shift(organization_id, auth.uid(), client_id));

ALTER POLICY "Org members can update shifts" ON public.scheduled_shifts
  USING (
    public.access_can_write_shift(organization_id, auth.uid(), client_id)
    OR (public.is_org_member(organization_id, auth.uid())
        AND (staff_id = auth.uid()
             OR (staff_id IS NULL AND status = ANY (ARRAY['open'::text, 'pending'::text]))))
  )
  WITH CHECK (
    public.access_can_write_shift(organization_id, auth.uid(), client_id)
    OR (public.is_org_member(organization_id, auth.uid())
        AND (staff_id = auth.uid()
             OR (staff_id IS NULL AND claim_requested_by = auth.uid())))
  );

ALTER POLICY "Org members can delete shifts" ON public.scheduled_shifts
  USING (public.access_can_write_shift(organization_id, auth.uid(), client_id));
