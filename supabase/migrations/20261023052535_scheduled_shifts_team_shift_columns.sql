-- B1: a shift can belong to a home or program instead of one client
-- (Decision 1: RHS home shifts and van/program shifts have no client; a 1:1
-- shift sets both team_id and client_id). Additive; client_id becomes nullable.
ALTER TABLE public.scheduled_shifts
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  ADD COLUMN open_spots integer CHECK (open_spots IS NULL OR open_spots >= 0),
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN pattern_line_id uuid,
  ADD COLUMN van_route_id uuid;
ALTER TABLE public.scheduled_shifts ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.scheduled_shifts ADD CONSTRAINT scheduled_shifts_client_or_team
  CHECK (client_id IS NOT NULL OR team_id IS NOT NULL);
CREATE INDEX scheduled_shifts_team_starts_idx ON public.scheduled_shifts (team_id, starts_at) WHERE team_id IS NOT NULL;
COMMENT ON COLUMN public.scheduled_shifts.team_id IS 'Home or program the shift is at (Decision 1).';
COMMENT ON COLUMN public.scheduled_shifts.open_spots IS 'Unfilled spots on an open shift.';
COMMENT ON COLUMN public.scheduled_shifts.confirmed_at IS 'When the team member confirmed the shift.';
COMMENT ON COLUMN public.scheduled_shifts.cancelled_at IS 'When the shift was cancelled (status says that it was).';
COMMENT ON COLUMN public.scheduled_shifts.pattern_line_id IS 'Rotation line that made the shift. Foreign key added in B6.';
COMMENT ON COLUMN public.scheduled_shifts.van_route_id IS 'Van route of a van run shift. Foreign key added in B8.';
