-- PHASE B — apply only after the host home source fix (teams.team_type + teams.manager_id) is on main
-- The host is the host home's lead (teams.manager_id) and the home kind is teams.team_type.
-- These older copies are no longer read or written by any code.
DROP TRIGGER IF EXISTS trg_teams_kind_from_setting ON public.teams;
DROP FUNCTION IF EXISTS public.teams_kind_from_setting();
ALTER TABLE public.teams DROP COLUMN IF EXISTS setting;
ALTER TABLE public.hhs_host_home_settings DROP COLUMN IF EXISTS hhp_name;
