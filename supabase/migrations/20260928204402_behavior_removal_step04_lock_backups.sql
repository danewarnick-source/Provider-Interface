-- Step 4. Lock the three backups. Row level security on, no policies,
-- and no access for anon or authenticated. service_role still bypasses RLS.
ALTER TABLE public.client_target_behaviors_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_target_behaviors_backup_20260928c FROM PUBLIC, anon, authenticated;

ALTER TABLE public.shift_behavior_observations_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_behavior_observations_backup_20260928c FROM PUBLIC, anon, authenticated;

ALTER TABLE public.org_shift_behavior_settings_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_shift_behavior_settings_backup_20260928c FROM PUBLIC, anon, authenticated;
