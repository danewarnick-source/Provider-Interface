-- A dose given by a team member without current medication training still
-- saves. log_medication_dose marks it here: the flag, and why
-- ('expired', 'unapproved' or 'not_set_up'). The app shows the fixed text
-- "Given by staff without current med training" for a flagged dose.
-- Additive; main doesn't read these columns.
alter table public.emar_logs
  add column if not exists given_without_current_training boolean not null default false,
  add column if not exists training_issue text;

alter table public.emar_logs
  add constraint emar_logs_training_issue_check
  check (
    (training_issue is null or training_issue in ('expired', 'unapproved', 'not_set_up'))
    and given_without_current_training = (training_issue is not null)
  );
