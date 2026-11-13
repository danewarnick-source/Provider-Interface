-- One column says what kind of home a team is: teams.team_type. Add 'host_home'
-- and copy host homes over from the older teams.setting column.
ALTER TABLE public.teams DROP CONSTRAINT teams_team_type_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_team_type_check
  CHECK (team_type = ANY (ARRAY['rhs_home','host_home','day_program','other']));

UPDATE public.teams SET team_type = 'host_home'
WHERE setting ILIKE '%host%' AND team_type <> 'host_home';

-- Until this PR is on main, main's code still writes teams.setting. Keep team_type
-- in step for host homes it saves. Dropped with teams.setting in the Phase B file.
CREATE OR REPLACE FUNCTION public.teams_kind_from_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.setting ILIKE '%host%' THEN
    NEW.team_type := 'host_home';
  ELSIF TG_OP = 'UPDATE' AND OLD.setting ILIKE '%host%' AND NEW.team_type = 'host_home'
        AND NEW.setting IS DISTINCT FROM OLD.setting THEN
    NEW.team_type := 'other';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.teams_kind_from_setting() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_teams_kind_from_setting
  BEFORE INSERT OR UPDATE OF setting ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.teams_kind_from_setting();
