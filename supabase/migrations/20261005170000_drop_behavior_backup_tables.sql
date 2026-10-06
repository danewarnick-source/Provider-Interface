-- Behavior tracking was removed on 2026-09-28 (behavior_removal_step01..04).
-- These frozen, RLS-locked backups are no longer needed; no code reads them.
DROP TABLE IF EXISTS public.client_target_behaviors_backup_20260928c;
DROP TABLE IF EXISTS public.shift_behavior_observations_backup_20260928c;
DROP TABLE IF EXISTS public.org_shift_behavior_settings_backup_20260928c;
