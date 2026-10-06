-- Provider Interface — Employees simplify (post-deploy handoff)
-- Owner: Dane. Do NOT run until the app deploy that removes these readers is live.
-- Do NOT add this file to supabase/migrations. Paste into the Lovable SQL editor
-- after clearing the editor. Nothing here is applied by this pull request.
--
-- Plain DROP TABLE IF EXISTS, children before parents. No CASCADE: every
-- dependent table in a batch is dropped here, or the table has no inbound
-- foreign key (verified in supabase/migrations). Generated types in
-- src/integrations/supabase/types.ts are not hand-edited; regenerate them
-- from the live schema after these drops.

-- =============================================================================
-- Batch 1 — Employee loans
-- App code, the /sign/employee-loan/$token route, and the signature email
-- helper were removed. client_loans, client_loan_entries, org_loan_settings,
-- and org_loan_attestations are a different product and are not dropped.
-- Child tables reference employee_loans (and signatures reference tokens).
-- The updated_at trigger uses shared public.update_updated_at_column();
-- that function stays.
-- =============================================================================

DROP TABLE IF EXISTS public.employee_loan_signatures;
DROP TABLE IF EXISTS public.employee_loan_signature_tokens;
DROP TABLE IF EXISTS public.employee_loan_entries;
DROP TABLE IF EXISTS public.employee_loans;

-- =============================================================================
-- Batch 2 — Training tracks (hire path was the only writer, and it always
-- passed an empty track list). After that insert was removed, no route,
-- server function, edge function, or SQL function reads or writes these.
-- track_programs.track_id is a uuid with no foreign key, so it does not
-- block this drop. track_programs itself has no app reader; it is left for
-- a follow-up (not on the confirmed-unused list).
-- Evidence: src/ no longer contains track_assignments or training_tracks
-- except generated types. /dashboard/tracks redirects to My Obligations.
-- hive_training_* and public /training checkout do not use these tables.
-- =============================================================================

DROP TABLE IF EXISTS public.track_assignments;
DROP TABLE IF EXISTS public.training_tracks;

-- =============================================================================
-- Batch 3 — Staff rotation groups
-- The only reader/writer was src/lib/scheduling/recurring.functions.ts,
-- which nothing imported. That file is deleted. recurring_shift_patterns
-- is not on the drop list: delete-client SQL still names it (the delete
-- is wrapped in EXCEPTION WHEN undefined_table). rotation_group_id on
-- that table is a plain uuid (no foreign key), so dropping the groups
-- does not require CASCADE. Follow-up: the pattern table has no remaining
-- app reader after this pull request.
-- Evidence: no remaining src/, edge-function, or migration reference
-- besides the original CREATE TABLE and generated types.
-- =============================================================================

DROP TABLE IF EXISTS public.staff_rotation_group_members;
DROP TABLE IF EXISTS public.staff_rotation_groups;

-- =============================================================================
-- Batch 4 — hr_document_access_log
-- Inserts lived only in src/lib/hr-staff.functions.ts (upload/view/delete).
-- That module was not imported anywhere. It is deleted. The log table
-- references hr_documents; hr_documents is NOT dropped (see kept list).
-- Dropping the log does not drop hr_documents. The append-only trigger
-- function is log-only and is dropped after the table.
-- =============================================================================

DROP TABLE IF EXISTS public.hr_document_access_log;
DROP FUNCTION IF EXISTS public.hr_document_access_log_immutable();

-- =============================================================================
-- Batch 5 — Already dropped in repo migrations. Repeated with IF EXISTS so a
-- live database that has not applied those migrations still loses them.
-- No app code reads or writes them.
--   staff_nudges                  — 20260817053649 and 20260819203000
--   staff_certifications          — 20260607090348 (audit area name in the
--                                   app queries external_certifications)
--   staff_training_hours_entries  — 20260819203500 (hours moved to ce_ledger)
-- None of these have an inbound foreign key in supabase/migrations.
-- =============================================================================

DROP TABLE IF EXISTS public.staff_nudges;
DROP TABLE IF EXISTS public.staff_certifications;
DROP TABLE IF EXISTS public.staff_training_hours_entries;

-- =============================================================================
-- Reviewed and intentionally NOT dropped
--
-- profiles.staff_type_keys
--   Follow-up only. Still written by hire and smart import, and still read
--   by policy gating (src/routes/__root.tsx, sign-policy), policy audience,
--   and forms assignment. Leave the column.
--
-- staff_types
--   Still read by forms assign (src/lib/forms.functions.ts) and policy
--   job-code options (src/lib/agency-policies.functions.ts). The HR Settings
--   propose-types UI is gone. Face sheet no longer reads this table.
--
-- nectar_requirements
--   Still the Nectar / Knowledge / obligations / forms catalog.
--
-- staff_other_assignments
--   The HR Admin rollup is gone. Reports still reads the table
--   (src/routes/dashboard.reports.tsx, assignment_type = 'training').
--
-- hr_documents
--   Still read by certificate OCR (src/lib/nectar-cert-ocr.ts), called from
--   training enrollment certificate upload and baseline training attach.
--   staff_checklist_completion.evidence_document_id and
--   training_enrollments.certificate_document_id reference it.
--
-- courses, course_assignments
--   Live course player, programs admin, auditor shares, reports, team page,
--   and the lesson_progress trigger. The unused roster query was removed.
--
-- training_classes, training_enrollments
--   Hive Training checkout, class roster, and Hive Exec fulfillment.
--   Public /training checkout uses training-only seats, not these drops.
--
-- training_modules, user_training_progress
--   Reports module-completions export embeds both.
--
-- staff_checklist_completion, remediation_plans, import_cert_documents
--   Obligations/forms, remediation, and Smart Import.
--
-- client_loans, client_loan_entries, org_loan_settings, org_loan_attestations
--   Client loan ledger. Untouched.
-- =============================================================================
