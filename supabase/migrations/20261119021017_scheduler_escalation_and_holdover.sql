-- Escalation ladder + hold-overs (ESCALATION-PLAN.md, Dane approved Nov 19). No new tables.

-- Why: one record of who was asked for a shift, whether or not a call-out started it.
ALTER TABLE public.callout_escalation_events
  ADD COLUMN scheduled_shift_id uuid REFERENCES public.scheduled_shifts(id) ON DELETE RESTRICT,
  ALTER COLUMN callout_id DROP NOT NULL,
  ADD CONSTRAINT callout_escalation_events_has_subject
    CHECK (callout_id IS NOT NULL OR scheduled_shift_id IS NOT NULL);
CREATE INDEX callout_escalation_events_shift_idx
  ON public.callout_escalation_events (scheduled_shift_id);

-- Writes: the call-out rule as before, OR (for a shift escalation) a scheduler,
-- OR the person who was asked recording their own answer. Shift must be in the same org.
ALTER POLICY "org members write escalation" ON public.callout_escalation_events
  WITH CHECK (
    is_org_member(organization_id, auth.uid()) AND (
      (callout_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.shift_callouts c
        WHERE c.id = callout_escalation_events.callout_id
          AND c.organization_id = callout_escalation_events.organization_id
          AND (c.staff_id = auth.uid() OR is_org_admin_or_manager(c.organization_id, auth.uid()))))
      OR (scheduled_shift_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.scheduled_shifts s
        WHERE s.id = callout_escalation_events.scheduled_shift_id
          AND s.organization_id = callout_escalation_events.organization_id)
        AND (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit')
             OR target_user_id = auth.uid()))
    )
  );

-- Why: a hold-over is an edit to a published shift (its end moves), recorded with its reason;
-- the fairness list ("held over longest ago") reads these rows.
ALTER TABLE public.shift_changes
  ADD COLUMN kind text NOT NULL DEFAULT 'edit' CHECK (kind IN ('edit', 'holdover')),
  ADD COLUMN reason text;
CREATE INDEX shift_changes_holdover_idx ON public.shift_changes (organization_id, changed_at)
  WHERE kind = 'holdover';
