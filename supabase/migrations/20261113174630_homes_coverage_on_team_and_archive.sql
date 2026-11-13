-- Settings › Homes. Staffing needs belong to the home (teams), not the legacy
-- locations table; homes are archived with a reason, never deleted.
-- Safe for main: location_id stays (now optional) until the Phase B file drops it.

-- Staffing needs keyed to the home. 0 rows live, nothing to move.
ALTER TABLE public.location_coverage_requirements
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  ALTER COLUMN location_id DROP NOT NULL;
CREATE INDEX location_coverage_requirements_team_id_idx
  ON public.location_coverage_requirements (team_id);

-- A staffing need can only point at a home in the same agency.
ALTER POLICY "admins write coverage reqs" ON public.location_coverage_requirements
  WITH CHECK (
    (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
    AND (team_id IS NULL OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = location_coverage_requirements.team_id
        AND t.organization_id = location_coverage_requirements.organization_id))
  );

-- Why: homes are archived (teams.active = false), never deleted; keep when and why.
ALTER TABLE public.teams
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_reason text;
