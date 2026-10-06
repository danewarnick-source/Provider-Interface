-- Clients: a person's records must never vanish with the client row.
--
-- 34 foreign keys to clients(id) were ON DELETE CASCADE and 3 were
-- ON DELETE SET NULL, so deleting a client silently erased (or detached)
-- daily logs, MAR, EVV timesheets, shifts, incidents, summaries, documents,
-- 1056 authorizations and more. Medicaid requires 7-year retention. Each FK is
-- recreated with ON DELETE RESTRICT — same name, same column — so a delete
-- that would orphan records fails instead. DROP + ADD inside one ALTER TABLE
-- keeps each swap atomic (Postgres can't change ON DELETE in place).
--
-- client_billing_codes, client_documents and client_emergency_contacts are
-- re-added NOT VALID: 6 existing rows (4 / 1 / 1) point at two clients that were
-- removed on 2026-08-24 with FK triggers bypassed. NOT VALID still enforces
-- RESTRICT and every new/updated row; the old rows are left for a person to
-- review (never deleted silently). Validate after review with
--   ALTER TABLE public.<table> VALIDATE CONSTRAINT <table>_client_id_fkey;
--
-- Already NO ACTION and left alone: host_supervision_contacts_client_id_fkey,
-- nectar_attestations_covers_client_id_fkey.
--
-- Verify after applying (expect 0):
--   select count(*) from pg_constraint
--   where contype = 'f' and confrelid = 'public.clients'::regclass
--     and confdeltype in ('c', 'n');

ALTER TABLE public.client_approved_locations
  DROP CONSTRAINT client_approved_locations_client_id_fkey,
  ADD CONSTRAINT client_approved_locations_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_billing_codes
  DROP CONSTRAINT client_billing_codes_client_id_fkey,
  ADD CONSTRAINT client_billing_codes_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.client_budgets
  DROP CONSTRAINT client_budgets_client_id_fkey,
  ADD CONSTRAINT client_budgets_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_documents
  DROP CONSTRAINT client_documents_client_id_fkey,
  ADD CONSTRAINT client_documents_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.client_emergency_contacts
  DROP CONSTRAINT client_emergency_contacts_client_id_fkey,
  ADD CONSTRAINT client_emergency_contacts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.client_external_services
  DROP CONSTRAINT client_external_services_client_id_fkey,
  ADD CONSTRAINT client_external_services_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_intake_completion
  DROP CONSTRAINT client_intake_completion_client_id_fkey,
  ADD CONSTRAINT client_intake_completion_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_loans
  DROP CONSTRAINT client_loans_client_id_fkey,
  ADD CONSTRAINT client_loans_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_meal_plans
  DROP CONSTRAINT client_meal_plans_client_id_fkey,
  ADD CONSTRAINT client_meal_plans_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_meal_support
  DROP CONSTRAINT client_meal_support_client_id_fkey,
  ADD CONSTRAINT client_meal_support_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_nutrition_config
  DROP CONSTRAINT client_nutrition_config_client_id_fkey,
  ADD CONSTRAINT client_nutrition_config_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_progress_summaries
  DROP CONSTRAINT client_progress_summaries_client_id_fkey,
  ADD CONSTRAINT client_progress_summaries_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_ratios
  DROP CONSTRAINT client_ratios_client_id_fkey,
  ADD CONSTRAINT client_ratios_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_recipes
  DROP CONSTRAINT client_recipes_client_id_fkey,
  ADD CONSTRAINT client_recipes_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_specific_trainings
  DROP CONSTRAINT client_specific_trainings_client_id_fkey,
  ADD CONSTRAINT client_specific_trainings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_staff_visibility
  DROP CONSTRAINT client_staff_visibility_client_id_fkey,
  ADD CONSTRAINT client_staff_visibility_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_weekly_targets
  DROP CONSTRAINT client_weekly_targets_client_id_fkey,
  ADD CONSTRAINT client_weekly_targets_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.company_obligation_instance_assignees
  DROP CONSTRAINT company_obligation_instance_assignees_client_id_fkey,
  ADD CONSTRAINT company_obligation_instance_assignees_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.company_obligation_instances
  DROP CONSTRAINT company_obligation_instances_client_id_fkey,
  ADD CONSTRAINT company_obligation_instances_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_logs
  DROP CONSTRAINT daily_logs_client_id_fkey,
  ADD CONSTRAINT daily_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.day_program_attendance
  DROP CONSTRAINT day_program_attendance_client_id_fkey,
  ADD CONSTRAINT day_program_attendance_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.emar_logs
  DROP CONSTRAINT emar_logs_client_id_fkey,
  ADD CONSTRAINT emar_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.evv_timesheets
  DROP CONSTRAINT evv_timesheets_client_id_fkey,
  ADD CONSTRAINT evv_timesheets_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.form_submissions
  DROP CONSTRAINT form_submissions_client_id_fkey,
  ADD CONSTRAINT form_submissions_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_host_home_monthly
  DROP CONSTRAINT hhs_host_home_monthly_client_id_fkey,
  ADD CONSTRAINT hhs_host_home_monthly_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_host_home_settings
  DROP CONSTRAINT hhs_host_home_settings_client_id_fkey,
  ADD CONSTRAINT hhs_host_home_settings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_monthly_certifications
  DROP CONSTRAINT hhs_monthly_certifications_client_id_fkey,
  ADD CONSTRAINT hhs_monthly_certifications_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.host_home_certifications
  DROP CONSTRAINT host_home_certifications_client_id_fkey,
  ADD CONSTRAINT host_home_certifications_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hrc_restriction_records
  DROP CONSTRAINT hrc_restriction_records_client_id_fkey,
  ADD CONSTRAINT hrc_restriction_records_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hrc_reviews
  DROP CONSTRAINT hrc_reviews_client_id_fkey,
  ADD CONSTRAINT hrc_reviews_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.import_merge_flags
  DROP CONSTRAINT import_merge_flags_client_id_fkey,
  ADD CONSTRAINT import_merge_flags_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_reports
  DROP CONSTRAINT incident_reports_client_id_fkey,
  ADD CONSTRAINT incident_reports_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.nectar_documents
  DROP CONSTRAINT nectar_documents_client_id_fkey,
  ADD CONSTRAINT nectar_documents_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.scheduled_shifts
  DROP CONSTRAINT scheduled_shifts_client_id_fkey,
  ADD CONSTRAINT scheduled_shifts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.shift_reports
  DROP CONSTRAINT shift_reports_client_id_fkey,
  ADD CONSTRAINT shift_reports_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.sjd_assessment_selections
  DROP CONSTRAINT sjd_assessment_selections_client_id_fkey,
  ADD CONSTRAINT sjd_assessment_selections_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_checklist_completion
  DROP CONSTRAINT staff_checklist_completion_client_id_fkey,
  ADD CONSTRAINT staff_checklist_completion_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

