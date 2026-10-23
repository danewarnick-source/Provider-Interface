-- Scheduler S1: allow the notification types the scheduler code already sends.
-- Inserts of these types were rejected by notifications_type_check and swallowed.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'incident_report_filed','incident_deadline_warning','timesheet_exception','daily_log_exception',
  'open_shift_warning','medication_error','form_assigned','form_reminder','form_due',
  'staff_mandate_missing','smart_import_flag','smart_import_provisional_cert',
  'smart_import_unverified_cert','smart_import_cert_expiring','smart_import_question',
  'shift_published','shift_updated','time_off_requested','time_off_decided',
  'company_obligation_reminder','company_obligation_update','hive_training_class','escalation',
  'swap_request','swap_partner_accepted','swap_approved','swap_assigned',
  'shift_claim_request','shift_claim_approved','shift_claim_denied',
  'shift_declined','shifts_published','shift_changed','callout'
]::text[]));
