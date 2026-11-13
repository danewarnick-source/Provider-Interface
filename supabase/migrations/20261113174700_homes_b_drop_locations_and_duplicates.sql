-- PHASE B — apply only after Settings › Homes is on main
-- Every row here is empty or unused once Settings › Homes ships (checked Nov 13, 2026):
-- location_coverage_requirements now keys on team_id; locations has 1 row and no reader;
-- client_ratios (0 rows) duplicated client_billing_codes.ratio; home_staff_designations
-- (0 rows) duplicated staff_assignments; clients.admin_hours_per_week has had no reader since B3.
-- home_designations (care-team role labels) is kept on purpose (CLAUDE.md).
ALTER TABLE public.location_coverage_requirements DROP COLUMN IF EXISTS location_id;
ALTER TABLE public.location_coverage_requirements ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS location_id;
DROP TABLE IF EXISTS public.locations;
DROP TABLE IF EXISTS public.client_ratios;
DROP TABLE IF EXISTS public.home_staff_designations;
ALTER TABLE public.clients DROP COLUMN IF EXISTS admin_hours_per_week;
