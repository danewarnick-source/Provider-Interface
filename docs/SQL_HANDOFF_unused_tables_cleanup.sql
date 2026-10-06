-- Unused-table cleanup handoff for Core.
-- Do not run this file as one script. Apply one numbered step at a time, in order.
-- Each step is independently runnable after the steps before it. No statement uses CASCADE.
-- This file was not applied to the live database. Do not add a migration for it in git.
-- Live project: dhrrukdcigiiqksibdfb. Row counts below are COUNT(*) on 2026-09-28.
--
-- DROP these 23 public tables (7 dead-code-only, then 16 unreferenced):
--   client_discharges
--   hive_training_course_modules
--   nectar_code_activations
--   nectar_requirement_category_history
--   nectar_requirement_usage
--   shift_templates
--   week_templates
--   attestations
--   celebration_acknowledgements
--   celebration_events
--   document_attestations
--   evidence_templates
--   file_records
--   nectar_compliance_instances
--   obligation_instance_assignees
--   obligation_instances
--   org_celebration_settings
--   org_facts
--   requirement_applicability
--   requirement_defs
--   reviews
--   user_celebration_mute
--   whiteboard_notes
--
-- KEEP nectar_attestations. Keep every other public table that is not in the
-- list of 23 above, including nectar_requirements, hive_training_courses,
-- organizations, clients, profiles, teams, users, nectar_documents,
-- company_obligations, and company_obligation_instances.
--
-- FLAG FOR CORE — do not drop:
--   Function public.nectar_requirements_freeze_original() and trigger
--   trg_nectar_requirements_freeze ON public.nectar_requirements.
--   That trigger serves the KEEP table nectar_requirements (it freezes
--   original_* columns). Its exception text mentions nectar_requirement_usage
--   only as a note to providers. It does not read or write that table.
--   Also do not drop the shared timestamp functions update_updated_at_column,
--   set_updated_at, and touch_updated_at. Triggers that call them on tables
--   in the drop list disappear with DROP TABLE:
--     trg_hive_training_course_modules_updated_at
--     trg_org_celeb_settings_updated_at
--     trg_user_celeb_mute_updated_at
--     shift_templates_touch
--     update_week_templates_updated_at
--     whiteboard_notes_set_updated_at
--
-- Recount on 2026-09-28 (backup only the six tables that have rows):
--   shift_templates                  36
--   celebration_acknowledgements     13
--   nectar_code_activations           8
--   celebration_events                5
--   whiteboard_notes                  4
--   hive_training_course_modules      3
--   attestations                      0
--   client_discharges                 0
--   document_attestations             0
--   evidence_templates                0
--   file_records                      0
--   nectar_compliance_instances       0
--   nectar_requirement_category_history 0
--   nectar_requirement_usage          0
--   obligation_instance_assignees     0
--   obligation_instances              0
--   org_celebration_settings          0
--   org_facts                         0
--   requirement_applicability         0
--   requirement_defs                  0
--   reviews                           0
--   user_celebration_mute             0
--   week_templates                    0
--
-- The only view on these tables is public.nectar_requirement_usage_current_v
-- (dropped in step 9). The only foreign key from a KEEP table into the 23 is
-- nectar_attestations.covers_instance_id -> nectar_compliance_instances
-- (constraint nectar_attestations_covers_instance_id_fkey, dropped in step 7;
-- the column stays). obligation_instances.evidence_file_id -> file_records is
-- a cycle inside the drop list (dropped in step 8 so file_records can go
-- before obligation_instances). nectar_requirement_usage.supersedes_id points
-- at itself and drops with that table.
--
-- Pre-flight. Run this before step 1. Expect the six non-zero counts above,
-- zeros for the other 17, exactly one outside foreign key
-- (nectar_attestations_covers_instance_id_fkey), and exactly one dependent
-- view (nectar_requirement_usage_current_v). Stop if any other outside
-- foreign key or view appears.
--
-- WITH drop_tables(relname) AS (
--   SELECT unnest(ARRAY[
--     'attestations','celebration_acknowledgements','celebration_events','client_discharges',
--     'document_attestations','evidence_templates','file_records','hive_training_course_modules',
--     'nectar_code_activations','nectar_compliance_instances','nectar_requirement_category_history',
--     'nectar_requirement_usage','obligation_instance_assignees','obligation_instances',
--     'org_celebration_settings','org_facts','requirement_applicability','requirement_defs',
--     'reviews','shift_templates','user_celebration_mute','week_templates','whiteboard_notes'
--   ])
-- ),
-- counts AS (
--   SELECT 'shift_templates' AS tbl, count(*)::bigint AS n FROM public.shift_templates
--   UNION ALL SELECT 'celebration_acknowledgements', count(*) FROM public.celebration_acknowledgements
--   UNION ALL SELECT 'nectar_code_activations', count(*) FROM public.nectar_code_activations
--   UNION ALL SELECT 'celebration_events', count(*) FROM public.celebration_events
--   UNION ALL SELECT 'whiteboard_notes', count(*) FROM public.whiteboard_notes
--   UNION ALL SELECT 'hive_training_course_modules', count(*) FROM public.hive_training_course_modules
--   UNION ALL SELECT 'attestations', count(*) FROM public.attestations
--   UNION ALL SELECT 'client_discharges', count(*) FROM public.client_discharges
--   UNION ALL SELECT 'document_attestations', count(*) FROM public.document_attestations
--   UNION ALL SELECT 'evidence_templates', count(*) FROM public.evidence_templates
--   UNION ALL SELECT 'file_records', count(*) FROM public.file_records
--   UNION ALL SELECT 'nectar_compliance_instances', count(*) FROM public.nectar_compliance_instances
--   UNION ALL SELECT 'nectar_requirement_category_history', count(*) FROM public.nectar_requirement_category_history
--   UNION ALL SELECT 'nectar_requirement_usage', count(*) FROM public.nectar_requirement_usage
--   UNION ALL SELECT 'obligation_instance_assignees', count(*) FROM public.obligation_instance_assignees
--   UNION ALL SELECT 'obligation_instances', count(*) FROM public.obligation_instances
--   UNION ALL SELECT 'org_celebration_settings', count(*) FROM public.org_celebration_settings
--   UNION ALL SELECT 'org_facts', count(*) FROM public.org_facts
--   UNION ALL SELECT 'requirement_applicability', count(*) FROM public.requirement_applicability
--   UNION ALL SELECT 'requirement_defs', count(*) FROM public.requirement_defs
--   UNION ALL SELECT 'reviews', count(*) FROM public.reviews
--   UNION ALL SELECT 'user_celebration_mute', count(*) FROM public.user_celebration_mute
--   UNION ALL SELECT 'week_templates', count(*) FROM public.week_templates
-- )
-- SELECT 'count' AS kind, tbl AS name, n::text AS detail FROM counts
-- UNION ALL
-- SELECT 'outside_fk', con.conname, src.relname || '.' || att.attname || ' -> ' || tgt.relname
-- FROM pg_constraint con
-- JOIN pg_class src ON src.oid = con.conrelid
-- JOIN pg_class tgt ON tgt.oid = con.confrelid
-- JOIN pg_namespace ns ON ns.oid = src.relnamespace
-- JOIN LATERAL unnest(con.conkey) AS ck(attnum) ON true
-- JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = ck.attnum
-- WHERE ns.nspname = 'public'
--   AND con.contype = 'f'
--   AND tgt.relname IN (SELECT relname FROM drop_tables)
--   AND src.relname NOT IN (SELECT relname FROM drop_tables)
-- UNION ALL
-- SELECT 'dependent_view', dependent.relname, source.relname
-- FROM pg_depend d
-- JOIN pg_rewrite r ON r.oid = d.objid
-- JOIN pg_class dependent ON dependent.oid = r.ev_class
-- JOIN pg_class source ON source.oid = d.refobjid
-- JOIN pg_namespace ns ON ns.oid = source.relnamespace
-- WHERE ns.nspname = 'public'
--   AND source.relname IN (SELECT relname FROM drop_tables)
--   AND dependent.relkind = 'v'
--   AND dependent.relname <> source.relname
-- ORDER BY 1, 2;

-- Step 1. Copy shift_templates (36 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.shift_templates_backup_20260928b AS SELECT * FROM public.shift_templates;
ALTER TABLE public.shift_templates_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_templates_backup_20260928b FROM anon, authenticated;

-- Step 2. Copy celebration_events (5 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.celebration_events_backup_20260928b AS SELECT * FROM public.celebration_events;
ALTER TABLE public.celebration_events_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_events_backup_20260928b FROM anon, authenticated;

-- Step 3. Copy celebration_acknowledgements (13 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.celebration_acknowledgements_backup_20260928b AS SELECT * FROM public.celebration_acknowledgements;
ALTER TABLE public.celebration_acknowledgements_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.celebration_acknowledgements_backup_20260928b FROM anon, authenticated;

-- Step 4. Copy nectar_code_activations (8 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.nectar_code_activations_backup_20260928b AS SELECT * FROM public.nectar_code_activations;
ALTER TABLE public.nectar_code_activations_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nectar_code_activations_backup_20260928b FROM anon, authenticated;

-- Step 5. Copy whiteboard_notes (4 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.whiteboard_notes_backup_20260928b AS SELECT * FROM public.whiteboard_notes;
ALTER TABLE public.whiteboard_notes_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whiteboard_notes_backup_20260928b FROM anon, authenticated;

-- Step 6. Copy hive_training_course_modules (3 rows on 2026-09-28). Lock the backup: RLS on, no policies.
CREATE TABLE public.hive_training_course_modules_backup_20260928b AS SELECT * FROM public.hive_training_course_modules;
ALTER TABLE public.hive_training_course_modules_backup_20260928b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hive_training_course_modules_backup_20260928b FROM anon, authenticated;

-- Step 7. Drop the foreign key from KEEP table nectar_attestations to nectar_compliance_instances.
-- Column public.nectar_attestations.covers_instance_id stays.
ALTER TABLE public.nectar_attestations DROP CONSTRAINT nectar_attestations_covers_instance_id_fkey;

-- Step 8. Drop the cycle obligation_instances.evidence_file_id -> file_records.
-- Column public.obligation_instances.evidence_file_id stays until step 33 drops the table.
-- Without this, step 14 cannot drop file_records while obligation_instances still points at it.
ALTER TABLE public.obligation_instances DROP CONSTRAINT obligation_instances_evidence_file_id_fkey;

-- Step 9. Drop the view that reads nectar_requirement_usage.
DROP VIEW public.nectar_requirement_usage_current_v;

-- Step 10. Drop the immutability trigger on nectar_requirement_category_history, then its function.
DROP TRIGGER trg_nectar_cat_hist_no_update ON public.nectar_requirement_category_history;
DROP FUNCTION public.nectar_req_cat_hist_immutable();

-- Step 11. Drop the immutability trigger on nectar_requirement_usage, then its function.
DROP TRIGGER trg_nectar_usage_no_update ON public.nectar_requirement_usage;
DROP FUNCTION public.nectar_requirement_usage_immutable();

-- Step 12. Child of celebration_events.
DROP TABLE public.celebration_acknowledgements;

-- Step 13. Child of obligation_instances (attestations.instance_id).
DROP TABLE public.attestations;

-- Step 14. Child of obligation_instances (file_records.instance_id). Cycle FK already dropped in step 8.
DROP TABLE public.file_records;

-- Step 15. Child of obligation_instances (obligation_instance_assignees.instance_id).
DROP TABLE public.obligation_instance_assignees;

-- Step 16. Child of obligation_instances (reviews.instance_id).
DROP TABLE public.reviews;

-- Step 17. Self-FK supersedes_id drops with the table. View already dropped in step 9.
DROP TABLE public.nectar_requirement_usage;

-- Step 18. Immutability trigger already dropped in step 10.
DROP TABLE public.nectar_requirement_category_history;

-- Step 19. FK from nectar_attestations already dropped in step 7. attestation_id still points at KEEP nectar_attestations.
DROP TABLE public.nectar_compliance_instances;

-- Step 20. course_id points at KEEP hive_training_courses.
DROP TABLE public.hive_training_course_modules;

-- Step 21.
DROP TABLE public.client_discharges;

-- Step 22.
DROP TABLE public.shift_templates;

-- Step 23.
DROP TABLE public.week_templates;

-- Step 24.
DROP TABLE public.document_attestations;

-- Step 25.
DROP TABLE public.evidence_templates;

-- Step 26.
DROP TABLE public.nectar_code_activations;

-- Step 27.
DROP TABLE public.org_celebration_settings;

-- Step 28.
DROP TABLE public.org_facts;

-- Step 29.
DROP TABLE public.requirement_applicability;

-- Step 30.
DROP TABLE public.whiteboard_notes;

-- Step 31.
DROP TABLE public.user_celebration_mute;

-- Step 32. Parent of celebration_acknowledgements (already dropped in step 12).
DROP TABLE public.celebration_events;

-- Step 33. Parent of attestations, file_records, obligation_instance_assignees, and reviews.
-- requirement_def_id still points at requirement_defs, so this drops before step 34.
DROP TABLE public.obligation_instances;

-- Step 34. Parent of obligation_instances.requirement_def_id.
DROP TABLE public.requirement_defs;
