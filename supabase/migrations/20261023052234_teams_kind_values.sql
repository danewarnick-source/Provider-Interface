-- B1: teams.team_type is the kind of home (Decision 1): rhs_home (a staffed RHS
-- home), day_program, or other (host homes and the rest). No new columns:
-- manager_id is the site lead and capacity is the licensed capacity.
-- Only the legacy locations sync (being removed) reads team_type on main, and it
-- maps rhs_home to residential as it did group_home.
ALTER TABLE public.teams DROP CONSTRAINT teams_team_type_check;
UPDATE public.teams SET team_type = 'rhs_home' WHERE team_type = 'group_home';
UPDATE public.teams SET team_type = 'other' WHERE team_type NOT IN ('rhs_home', 'day_program');
ALTER TABLE public.teams ADD CONSTRAINT teams_team_type_check
  CHECK (team_type IN ('rhs_home', 'day_program', 'other'));
COMMENT ON COLUMN public.teams.team_type IS 'Kind of home: rhs_home, day_program or other (host homes and the rest).';
COMMENT ON COLUMN public.teams.manager_id IS 'Site lead: runs the home and reviews its notes.';
COMMENT ON COLUMN public.teams.capacity IS 'Licensed capacity of the home or program.';
