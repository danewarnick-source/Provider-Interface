-- Team members: a person's work records must never vanish with the person.
--
-- These 20 foreign keys pointed at profiles(id) / auth.users(id) with
-- ON DELETE CASCADE, so deleting a person silently erased their shifts, daily
-- logs, incident reports, training progress, policy signatures, attestations,
-- pay rows and obligation history. Each is recreated with ON DELETE RESTRICT —
-- same constraint name, same column, same referenced table — so a delete that
-- would orphan work records fails instead of destroying them. Postgres cannot
-- change an FK's ON DELETE action in place; DROP + ADD inside one ALTER TABLE
-- keeps each swap atomic and takes the table lock once.
--
-- Deliberately left ON DELETE CASCADE (account-shaped rows that belong with
-- the account, not work records): profiles_id_fkey,
-- user_ui_dismissals_user_id_fkey, feature_upgrade_requests_requested_by_fkey,
-- auditor_accounts_user_id_fkey, staff_group_members_staff_id_fkey,
-- home_staff_designations_staff_id_fkey, hr_documents_staff_id_fkey.
-- Supabase-managed auth.* internals are untouched.
--
-- Verify after applying:
--   select conname from pg_constraint
--   where contype = 'f' and confdeltype = 'c'
--     and confrelid in ('public.profiles'::regclass, 'auth.users'::regclass);
-- Only the seven names above (plus auth.* internals) should remain.

-- ---- references profiles(id) ------------------------------------------------

ALTER TABLE public.company_obligation_completions
  DROP CONSTRAINT company_obligation_completions_staff_id_fkey,
  ADD CONSTRAINT company_obligation_completions_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.company_obligation_instance_assignees
  DROP CONSTRAINT company_obligation_instance_assignees_staff_id_fkey,
  ADD CONSTRAINT company_obligation_instance_assignees_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.company_obligation_instances
  DROP CONSTRAINT company_obligation_instances_assignee_staff_id_fkey,
  ADD CONSTRAINT company_obligation_instances_assignee_staff_id_fkey
    FOREIGN KEY (assignee_staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_logs
  DROP CONSTRAINT daily_logs_user_id_fkey,
  ADD CONSTRAINT daily_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.general_shifts
  DROP CONSTRAINT general_shifts_user_id_fkey,
  ADD CONSTRAINT general_shifts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_reports
  DROP CONSTRAINT incident_reports_reported_by_fkey,
  ADD CONSTRAINT incident_reports_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.scheduled_shifts
  DROP CONSTRAINT scheduled_shifts_staff_id_fkey,
  ADD CONSTRAINT scheduled_shifts_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.shift_callouts
  DROP CONSTRAINT shift_callouts_staff_id_fkey,
  ADD CONSTRAINT shift_callouts_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.shift_reports
  DROP CONSTRAINT shift_reports_staff_id_fkey,
  ADD CONSTRAINT shift_reports_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.shift_swap_requests
  DROP CONSTRAINT shift_swap_requests_from_staff_id_fkey,
  ADD CONSTRAINT shift_swap_requests_from_staff_id_fkey
    FOREIGN KEY (from_staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_checklist_completion
  DROP CONSTRAINT staff_checklist_completion_staff_id_fkey,
  ADD CONSTRAINT staff_checklist_completion_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.time_off_requests
  DROP CONSTRAINT time_off_requests_staff_id_fkey,
  ADD CONSTRAINT time_off_requests_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- ---- references auth.users(id) ----------------------------------------------

ALTER TABLE public.contractor_monthly_pay
  DROP CONSTRAINT contractor_monthly_pay_staff_id_fkey,
  ADD CONSTRAINT contractor_monthly_pay_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.day_program_session_staff
  DROP CONSTRAINT day_program_session_staff_staff_id_fkey,
  ADD CONSTRAINT day_program_session_staff_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.document_attestations
  DROP CONSTRAINT document_attestations_staff_id_fkey,
  ADD CONSTRAINT document_attestations_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.policy_signatures
  DROP CONSTRAINT policy_signatures_user_id_fkey,
  ADD CONSTRAINT policy_signatures_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.training_completions
  DROP CONSTRAINT training_completions_user_id_fkey,
  ADD CONSTRAINT training_completions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.training_person_modules
  DROP CONSTRAINT training_person_modules_user_id_fkey,
  ADD CONSTRAINT training_person_modules_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.training_topic_progress
  DROP CONSTRAINT training_topic_progress_user_id_fkey,
  ADD CONSTRAINT training_topic_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- user_training_progress: at apply time 13 existing rows referenced three
-- user_ids absent from auth.users (11111111-1111-1111-1111-111111111111,
-- 22222222-2222-2222-2222-222222222222, 33333333-3333-3333-3333-333333333333 —
-- synthetic fixture ids written with FK checks bypassed; the old CASCADE FK
-- was never re-validated against them). A validated constraint refuses to be
-- created over them, and a migration never deletes records, so this one
-- constraint is added NOT VALID: it is enforced for every new insert/update
-- and its ON DELETE RESTRICT action applies immediately — only the one-time
-- scan of existing rows is skipped. Once those fixture rows have been dealt
-- with deliberately, finish with:
--   ALTER TABLE public.user_training_progress
--     VALIDATE CONSTRAINT user_training_progress_user_id_fkey;
ALTER TABLE public.user_training_progress
  DROP CONSTRAINT user_training_progress_user_id_fkey,
  ADD CONSTRAINT user_training_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT NOT VALID;
