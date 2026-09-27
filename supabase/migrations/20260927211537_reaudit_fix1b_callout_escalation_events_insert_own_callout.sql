-- Re-audit follow-up: escalation events may only be inserted for a call-out in the same org that belongs to the
-- inserter (shift_callouts.staff_id = auth.uid()), or by an org admin/manager (is_org_admin_or_manager) of that org.
-- Only writer is the browser client in src/routes/dashboard.shift.$shiftId.tsx; no DB functions/triggers/cron/edge functions.
DROP POLICY IF EXISTS "org members write escalation" ON public.callout_escalation_events;
CREATE POLICY "org members write escalation" ON public.callout_escalation_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND EXISTS (SELECT 1 FROM public.shift_callouts c WHERE c.id = callout_escalation_events.callout_id AND c.organization_id = callout_escalation_events.organization_id AND (c.staff_id = auth.uid() OR is_org_admin_or_manager(c.organization_id, auth.uid()))));
