-- These tables carry a client_id with no foreign key to clients, so rows could
-- point at clients that don't exist (2 client_medications rows already do).
-- Add ON DELETE RESTRICT foreign keys.
--
-- client_medications is added NOT VALID: it enforces every new/updated row
-- now, while the 2 existing orphan rows are reviewed by a person before
-- anything is changed (they are medication PHI; never delete silently).
-- Validate later with:
--   ALTER TABLE public.client_medications VALIDATE CONSTRAINT client_medications_client_id_fkey;
--
-- Deliberately not linked:
--   phi_access_audit_log — audit writes must never fail on a bad id.
--   *_backup_20260928c — frozen backups.
--   recurring_shift_patterns — unused, scheduled for removal.

ALTER TABLE public.client_medications
  ADD CONSTRAINT client_medications_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.activity_reimbursement_requests
  ADD CONSTRAINT activity_reimbursement_requests_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.agency_bank_mappings
  ADD CONSTRAINT agency_bank_mappings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_belongings
  ADD CONSTRAINT client_belongings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_billing_code_rate_history
  ADD CONSTRAINT client_billing_code_rate_history_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.client_spending_log
  ADD CONSTRAINT client_spending_log_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.controlled_med_counts
  ADD CONSTRAINT controlled_med_counts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_client_inventories
  ADD CONSTRAINT hhs_client_inventories_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_evacuation_drills
  ADD CONSTRAINT hhs_evacuation_drills_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_incident_reports
  ADD CONSTRAINT hhs_incident_reports_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_medical_logs
  ADD CONSTRAINT hhs_medical_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_monthly_attendance
  ADD CONSTRAINT hhs_monthly_attendance_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_monthly_summaries
  ADD CONSTRAINT hhs_monthly_summaries_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.hhs_transfer_logs
  ADD CONSTRAINT hhs_transfer_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.medication_change_proposals
  ADD CONSTRAINT medication_change_proposals_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.medication_transfers
  ADD CONSTRAINT medication_transfers_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.pba_accounts
  ADD CONSTRAINT pba_accounts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.shift_completeness_flags
  ADD CONSTRAINT shift_completeness_flags_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.submitted_forms
  ADD CONSTRAINT submitted_forms_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.threads
  ADD CONSTRAINT threads_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE public.upi_attestations
  ADD CONSTRAINT upi_attestations_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
