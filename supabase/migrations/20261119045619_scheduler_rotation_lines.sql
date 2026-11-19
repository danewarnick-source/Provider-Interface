-- B6 Rotations (B6-PLAN.md, Dane approved Nov 19). The empty recurring_shift_patterns
-- table becomes the rotation-line table (0 rows live); no new table.

-- Why each column: a line is for a home (team_id) or a client; it names the code and the
-- B2 shift type it creates; cycle = on/off day counts (e.g. {5,2}, {2,2,3,2,2,3}) counted
-- from cycle_start. Set-weekday lines keep using weekday_mask.
ALTER TABLE public.recurring_shift_patterns
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  ADD COLUMN service_code text,
  ADD COLUMN shift_type text,
  ADD COLUMN cycle integer[],
  ADD COLUMN cycle_start date,
  ADD CONSTRAINT recurring_shift_patterns_has_place CHECK (team_id IS NOT NULL OR client_id IS NOT NULL),
  ADD CONSTRAINT recurring_shift_patterns_has_pattern CHECK (cycle IS NOT NULL OR weekday_mask > 0),
  ADD CONSTRAINT recurring_shift_patterns_cycle_needs_start CHECK (cycle IS NULL OR cycle_start IS NOT NULL);
CREATE INDEX recurring_shift_patterns_org_active_idx ON public.recurring_shift_patterns (organization_id) WHERE active;

-- Generated shifts point at their line; a hand edit sets this to null (detach).
ALTER TABLE public.scheduled_shifts
  ADD CONSTRAINT scheduled_shifts_pattern_line_id_fkey
  FOREIGN KEY (pattern_line_id) REFERENCES public.recurring_shift_patterns(id) ON DELETE RESTRICT;
CREATE INDEX scheduled_shifts_pattern_line_idx ON public.scheduled_shifts (pattern_line_id) WHERE pattern_line_id IS NOT NULL;

-- Access: like every scheduler table — Scheduling view to read, Scheduling edit to write;
-- a line may only point at a home or client in the same agency.
ALTER POLICY "Org members can view recurring patterns" ON public.recurring_shift_patterns
  USING (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'view')
         OR public.is_hive_executive(auth.uid()));
ALTER POLICY "Admins manage recurring patterns" ON public.recurring_shift_patterns
  USING (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit'))
  WITH CHECK (
    public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit')
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t
         WHERE t.id = recurring_shift_patterns.team_id AND t.organization_id = recurring_shift_patterns.organization_id))
    AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients c
         WHERE c.id = recurring_shift_patterns.client_id AND c.organization_id = recurring_shift_patterns.organization_id))
  );
