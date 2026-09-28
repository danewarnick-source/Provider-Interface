-- Behavior removal handoff for the database owner.
-- Do not run this file as one script. Run the pre-flight queries first.
-- If a pre-flight result does not match the comment under it, stop.
-- This file was not applied to the live database.
-- Live project: dhrrukdcigiiqksibdfb. Counts below are from a read on 2026-09-28.
--
-- Kept on purpose (do not drop):
--   hrc_meetings, hrc_restriction_records, hrc_reviews
--   Evidence FBA/BSP packs, requirement rows, and file uploads
--   incident_reports (including any behavior category)
--   public.update_updated_at_column(), public.set_updated_at(), public.touch_updated_at()
--   public.org_shift_behavior_settings (see step 16). Scheduling still reads
--     rule_settings and ot_threshold_hours from this table. Only the unused
--     enabled column is removed.
--   public.profiles.bc_role and the bc_code enum. The app no longer reads
--     bc_role. Dropping the column is outside this handoff.
--   Enums that become unused after the drops (bc_behavior_source,
--     bc_behavior_status, bc_doc_type, bc_flag_type, bc_review_note_type).
--     They do not block DROP TABLE. Leave them.
--
-- delete_client_hard does not reference any of the nine tables.
-- No CREATE OR REPLACE is included. If pre-flight 5 returns any name other
-- than bc_touch_behavior_last_logged, stop. Do not invent a rewrite.

-- =============================================================================
-- PRE-FLIGHT. Read only. Compare each result to the comment under the query.
-- =============================================================================

-- 1. Row counts. Expected:
--    bc_behaviors 0
--    bc_data_entries 0
--    bc_documents 0
--    bc_flags 0
--    bc_review_notes 0
--    behavior_support_clients 0
--    client_target_behaviors 1
--    org_shift_behavior_settings 1
--    shift_behavior_observations 3
-- Backup every table whose count is greater than 0. On 2026-09-28 that is
-- the three tables in steps 1-3. The other six are empty and are not backed up.
SELECT 'bc_behaviors' AS table_name, count(*) AS rows FROM public.bc_behaviors
UNION ALL SELECT 'bc_data_entries', count(*) FROM public.bc_data_entries
UNION ALL SELECT 'bc_documents', count(*) FROM public.bc_documents
UNION ALL SELECT 'bc_flags', count(*) FROM public.bc_flags
UNION ALL SELECT 'bc_review_notes', count(*) FROM public.bc_review_notes
UNION ALL SELECT 'behavior_support_clients', count(*) FROM public.behavior_support_clients
UNION ALL SELECT 'client_target_behaviors', count(*) FROM public.client_target_behaviors
UNION ALL SELECT 'shift_behavior_observations', count(*) FROM public.shift_behavior_observations
UNION ALL SELECT 'org_shift_behavior_settings', count(*) FROM public.org_shift_behavior_settings
ORDER BY 1;

-- 2. Foreign keys touching the nine tables. Expected: no outside table
--    references these nine. The only foreign key inside the set is
--    bc_data_entries.behavior_id -> bc_behaviors(id) ON DELETE CASCADE.
--    Every other foreign key points at a kept parent
--    (clients, organizations, auth.users, evv_timesheets).
--    org_shift_behavior_settings.organization_id -> organizations(id) stays,
--    because that table stays.
SELECT conrelid::regclass AS child_table,
       confrelid::regclass AS parent_table,
       conname,
       pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype = 'f'
  AND (
    conrelid::regclass::text IN (
      'bc_behaviors','bc_data_entries','bc_documents','bc_flags','bc_review_notes',
      'behavior_support_clients','client_target_behaviors','shift_behavior_observations',
      'org_shift_behavior_settings'
    )
    OR confrelid::regclass::text IN (
      'bc_behaviors','bc_data_entries','bc_documents','bc_flags','bc_review_notes',
      'behavior_support_clients','client_target_behaviors','shift_behavior_observations',
      'org_shift_behavior_settings'
    )
  )
ORDER BY 1, 3;

-- 3. Views whose definition mentions the nine tables. Expected: zero rows.
--    If this returns a row, stop. There is no DROP VIEW step.
SELECT n.nspname AS schema_name, c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND pg_get_viewdef(c.oid) ~ 'bc_behaviors|bc_data_entries|bc_documents|bc_flags|bc_review_notes|behavior_support_clients|client_target_behaviors|shift_behavior_observations|org_shift_behavior_settings'
ORDER BY 1, 2;

-- 4. Triggers on the nine tables. Expected:
--    bc_behaviors                  trg_bc_behaviors_updated                  update_updated_at_column
--    bc_data_entries               trg_bc_data_updated                       update_updated_at_column
--    bc_data_entries               trg_bc_touch_last_logged                  bc_touch_behavior_last_logged
--    bc_documents                  trg_bc_docs_updated                       update_updated_at_column
--    bc_flags                      trg_bc_flags_updated                      update_updated_at_column
--    bc_review_notes               trg_bc_notes_updated                      update_updated_at_column
--    behavior_support_clients      trg_bsc_updated                           update_updated_at_column
--    client_target_behaviors       trg_ctb_updated                           update_updated_at_column
--    org_shift_behavior_settings   trg_org_shift_behavior_settings_updated_at update_updated_at_column
--    shift_behavior_observations   trg_shift_behavior_obs_updated_at         update_updated_at_column
-- Do not drop update_updated_at_column. Do not drop
-- trg_org_shift_behavior_settings_updated_at.
SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN (
    'bc_behaviors','bc_data_entries','bc_documents','bc_flags','bc_review_notes',
    'behavior_support_clients','client_target_behaviors','shift_behavior_observations',
    'org_shift_behavior_settings'
  )
ORDER BY 1, 2;

-- 5. Functions whose source mentions the nine tables. Expected: exactly one row,
--    public.bc_touch_behavior_last_logged.
--    delete_client_hard is not in this list. No rewrite of it is required.
--    If any other function appears, stop.
SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prosrc ~ 'bc_behaviors|bc_data_entries|bc_documents|bc_flags|bc_review_notes|behavior_support_clients|client_target_behaviors|shift_behavior_observations|org_shift_behavior_settings'
ORDER BY 1, 2;

-- 6. Policies on the nine tables, plus the four storage policies for the
--    bc-documents bucket. Expected table policies (they disappear with DROP TABLE):
--    bc_behaviors: bc_behaviors_admin_full, bc_behaviors_behaviorist_full,
--      bc_behaviors_staff_read_published
--    bc_data_entries: bc_data_admin_full, bc_data_behaviorist_full,
--      bc_data_staff_insert_own, bc_data_staff_read_own
--    bc_documents: bc_docs_admin_write, bc_docs_read_visible
--    bc_flags: bc_flags_admin_full, bc_flags_behaviorist_read,
--      bc_flags_behaviorist_update, bc_flags_behaviorist_write
--    bc_review_notes: bc_notes_admin_full, bc_notes_behaviorist_full
--    behavior_support_clients: bsc_admin_full, bsc_behaviorist_assigned_read,
--      bsc_staff_caseload_read
--    client_target_behaviors: ctb_read, ctb_write
--    shift_behavior_observations: "Staff insert own shift behavior obs",
--      "Staff read own; admins read org shift behavior obs",
--      "Staff update own; admins update org shift behavior obs"
--    org_shift_behavior_settings (KEEP both): "Admins manage their org behavior setting",
--      "Members can read their org behavior setting"
--    storage.objects (drop in step 14; they subquery the behavior tables):
--      bc_docs_delete, bc_docs_read, bc_docs_update, bc_docs_write
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
    'bc_behaviors','bc_data_entries','bc_documents','bc_flags','bc_review_notes',
    'behavior_support_clients','client_target_behaviors','shift_behavior_observations',
    'org_shift_behavior_settings'
  )
  OR (schemaname = 'storage' AND policyname LIKE 'bc_docs%')
ORDER BY 1, 2, 3;

-- 7. bc-documents bucket. Expected: one bucket row, and zero objects.
--    If the object count is not 0, stop before step 15.
SELECT id, name, public FROM storage.buckets WHERE id = 'bc-documents';
SELECT count(*) AS bc_documents_objects FROM storage.objects WHERE bucket_id = 'bc-documents';

-- =============================================================================
-- NUMBERED STEPS. Run one at a time, in order, after the pre-flight matches.
-- =============================================================================

-- Step 1. Copy the 1 client_target_behaviors row before that table is dropped.
CREATE TABLE IF NOT EXISTS public.client_target_behaviors_backup_20260928c
AS SELECT * FROM public.client_target_behaviors;

-- Step 2. Copy the 3 shift_behavior_observations rows before that table is dropped.
CREATE TABLE IF NOT EXISTS public.shift_behavior_observations_backup_20260928c
AS SELECT * FROM public.shift_behavior_observations;

-- Step 3. Copy the 1 org_shift_behavior_settings row. The live table stays
-- (step 16). This backup is the copy of the behavior toggle plus the
-- scheduling columns, taken before enabled is removed.
CREATE TABLE IF NOT EXISTS public.org_shift_behavior_settings_backup_20260928c
AS SELECT * FROM public.org_shift_behavior_settings;

-- Step 4. Lock the three backups. Row level security on, no policies,
-- and no access for anon or authenticated. service_role still bypasses RLS.
ALTER TABLE public.client_target_behaviors_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_target_behaviors_backup_20260928c FROM PUBLIC, anon, authenticated;

ALTER TABLE public.shift_behavior_observations_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_behavior_observations_backup_20260928c FROM PUBLIC, anon, authenticated;

ALTER TABLE public.org_shift_behavior_settings_backup_20260928c ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_shift_behavior_settings_backup_20260928c FROM PUBLIC, anon, authenticated;

-- Step 5. Drop the behavior-only trigger and its function. Leave
-- update_updated_at_column in place.
DROP TRIGGER IF EXISTS trg_bc_touch_last_logged ON public.bc_data_entries;
DROP FUNCTION IF EXISTS public.bc_touch_behavior_last_logged();

-- Step 6. Drop the updated-at triggers on the tables that will be dropped.
-- These call update_updated_at_column. The function stays.
DROP TRIGGER IF EXISTS trg_bc_data_updated ON public.bc_data_entries;
DROP TRIGGER IF EXISTS trg_bc_behaviors_updated ON public.bc_behaviors;
DROP TRIGGER IF EXISTS trg_bc_docs_updated ON public.bc_documents;
DROP TRIGGER IF EXISTS trg_bc_flags_updated ON public.bc_flags;
DROP TRIGGER IF EXISTS trg_bc_notes_updated ON public.bc_review_notes;
DROP TRIGGER IF EXISTS trg_bsc_updated ON public.behavior_support_clients;
DROP TRIGGER IF EXISTS trg_ctb_updated ON public.client_target_behaviors;
DROP TRIGGER IF EXISTS trg_shift_behavior_obs_updated_at ON public.shift_behavior_observations;

-- Step 7. No views to drop. Pre-flight 3 must still be empty. If it is not, stop.

-- Step 8. Drop bc_data_entries first. It is the only child inside the set
-- (behavior_id -> bc_behaviors). No CASCADE.
DROP TABLE IF EXISTS public.bc_data_entries;

-- Step 9. Drop the remaining behaviorist-workspace tables. No CASCADE.
DROP TABLE IF EXISTS public.bc_behaviors;
DROP TABLE IF EXISTS public.bc_documents;
DROP TABLE IF EXISTS public.bc_flags;
DROP TABLE IF EXISTS public.bc_review_notes;
DROP TABLE IF EXISTS public.behavior_support_clients;

-- Step 10. Drop the shift target-behavior list. No CASCADE.
DROP TABLE IF EXISTS public.client_target_behaviors;

-- Step 11. Drop per-shift behavior observations. No CASCADE.
DROP TABLE IF EXISTS public.shift_behavior_observations;

-- Step 12. Do not drop public.org_shift_behavior_settings.
-- Scheduling conflict rules and the overtime threshold still live in
-- rule_settings and ot_threshold_hours. Dropping the table would break
-- getRuleSettings, updateRuleSettings, and evaluateRange. The behavior
-- toggle was the enabled column only. That column is removed in step 16,
-- after the storage cleanup.

-- Step 13. Confirm delete_client_hard still does not mention the dropped
-- tables. Expected: zero rows. If a row appears, stop and add a
-- CREATE OR REPLACE that removes those references before continuing.
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'delete_client_hard'
  AND p.prosrc ~ 'bc_behaviors|bc_data_entries|bc_documents|bc_flags|bc_review_notes|behavior_support_clients|client_target_behaviors|shift_behavior_observations';

-- Step 14. Drop the storage policies that exist only for the behaviorist
-- document bucket. They subquery bc_documents and behavior_support_clients,
-- so they must go even though DROP TABLE does not remove them.
DROP POLICY IF EXISTS "bc_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_write" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "bc_docs_delete" ON storage.objects;

-- Step 15. Remove the empty bc-documents bucket. Re-check the object count
-- first. If it is not 0, stop and do not delete the bucket.
-- SELECT count(*) FROM storage.objects WHERE bucket_id = 'bc-documents';
DELETE FROM storage.buckets WHERE id = 'bc-documents';

-- Step 16. Remove the unused behavior toggle from the scheduling settings
-- table. Do not drop the table, its policies, its updated-at trigger, or
-- rule_settings / ot_threshold_hours.
ALTER TABLE public.org_shift_behavior_settings
  DROP COLUMN IF EXISTS enabled;
