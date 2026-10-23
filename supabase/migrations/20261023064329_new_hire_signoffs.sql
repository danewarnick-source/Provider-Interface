-- B2: a lead's (or the owner's) sign-off that a team member may work alone at
-- a home (Decision 8). Without one, they're a new hire there and work paired
-- shifts. Undoing a sign-off ends it with a reason; rows are never deleted.
CREATE TABLE public.new_hire_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  signed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  end_reason text,
  CHECK ((ended_at IS NULL) = (ended_by IS NULL))
);
CREATE UNIQUE INDEX new_hire_signoffs_one_open ON public.new_hire_signoffs (staff_id, team_id) WHERE ended_at IS NULL;
CREATE INDEX new_hire_signoffs_org_idx ON public.new_hire_signoffs (organization_id);
ALTER TABLE public.new_hire_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY new_hire_signoffs_read ON public.new_hire_signoffs FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
-- The owner, or the home's lead, signs off; the signer is always the caller.
CREATE POLICY new_hire_signoffs_insert ON public.new_hire_signoffs FOR INSERT TO authenticated
  WITH CHECK (signed_by = auth.uid() AND ended_at IS NULL AND (
    access_is_owner(organization_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organization_id = new_hire_signoffs.organization_id AND t.manager_id = auth.uid())));
CREATE POLICY new_hire_signoffs_end ON public.new_hire_signoffs FOR UPDATE TO authenticated
  USING (access_is_owner(organization_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid()))
  WITH CHECK (ended_by = auth.uid());
