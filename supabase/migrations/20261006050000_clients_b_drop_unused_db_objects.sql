-- PHASE B — apply only AFTER the Clients 2f code is merged to main.
-- Verified live on 2026-10-05 before writing:
--   recurring_shift_patterns: 0 rows, no inbound FKs, no code references.
--   day_program_billable_v / employee_client_assignments: views with no
--     dependents and no code references (the latter only re-selects
--     staff_assignments, so no data is lost).
--   bc_behavior_source / bc_behavior_status / bc_doc_type / bc_flag_type /
--     bc_review_note_type: no column, function or view uses them.
-- Kept on purpose: profiles.bc_role and the bc_code type (one live profile
-- holds BC3), and the empty bc-documents bucket (delete it from the Storage
-- dashboard; direct SQL deletes on storage tables are blocked).

drop view if exists public.day_program_billable_v;
drop view if exists public.employee_client_assignments;
drop table if exists public.recurring_shift_patterns;

drop type if exists public.bc_behavior_source;
drop type if exists public.bc_behavior_status;
drop type if exists public.bc_doc_type;
drop type if exists public.bc_flag_type;
drop type if exists public.bc_review_note_type;
