-- Meds rebuild M1 (audit): staff could edit a logged dose through the
-- "staff update own emar" policy. Until M6 replaces that policy, refuse
-- signed-in users changing what was charted: time, status, route, med,
-- client, who logged it and counts. Corrections are addenda. Still allowed:
-- the admin review flag/notes and the PRN follow-up fields M5 fills in.
-- No app code updates emar_logs today (checked), so nothing in main breaks.
-- Server-side SECURITY DEFINER functions and the service role are not
-- affected (current_user is not a request role there).
create or replace function public.emar_logs_lock_logged_dose()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id
     or new.client_id is distinct from old.client_id
     or new.medication_id is distinct from old.medication_id
     or new.scheduled_for is distinct from old.scheduled_for
     or new.scheduled_time_label is distinct from old.scheduled_time_label
     or new.administered_at is distinct from old.administered_at
     or new.actual_taken_at is distinct from old.actual_taken_at
     or new.documented_at is distinct from old.documented_at
     or new.status is distinct from old.status
     or new.route is distinct from old.route
     or new.staff_id is distinct from old.staff_id
     or new.staff_name is distinct from old.staff_name
     or new.administrator_role is distinct from old.administrator_role
     or new.is_prn is distinct from old.is_prn
     or new.prn_reason is distinct from old.prn_reason
     or new.is_controlled is distinct from old.is_controlled
     or new.pill_count_verified is distinct from old.pill_count_verified
     or new.pill_count_value is distinct from old.pill_count_value
     or new.signature_attestation is distinct from old.signature_attestation
     or new.signature_data_url is distinct from old.signature_data_url
     or new.second_witness_id is distinct from old.second_witness_id
     or new.client_request_id is distinct from old.client_request_id
  then
    raise exception 'A logged dose can''t be changed. Add a correction instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_emar_logs_lock_logged_dose
  before update on public.emar_logs
  for each row execute function public.emar_logs_lock_logged_dose();
