-- Meds rebuild M1 (audit): one SQL function charts a dose. It locks the
-- medication row (SELECT ... FOR UPDATE) so two fast taps or two staff can't
-- both pass the PRN minimum-interval and daily-maximum checks, re-checks
-- that the med belongs to the client, is active and not paused, that the
-- caller may chart for this client, and that the dose isn't already charted.
-- A retried request (same client_request_id) returns the first row's id.
-- Called by logMedicationPass with the caller's own session (auth.uid()).
create or replace function public.log_medication_dose(_dose jsonb, _prn_override_reason text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_med public.client_medications%rowtype;
  r public.emar_logs%rowtype;
  v_existing public.emar_logs%rowtype;
  v_taken_at timestamptz;
  v_last timestamptz;
  v_count int;
  v_exception text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  r := jsonb_populate_record(null::public.emar_logs, _dose);
  if r.client_request_id is null then
    raise exception 'Each dose needs a request id.' using errcode = '22023';
  end if;

  select * into v_med from public.client_medications where id = r.medication_id for update;
  if not found then
    raise exception 'Medication not found.' using errcode = 'P0002';
  end if;
  if v_med.client_id is distinct from r.client_id then
    raise exception 'This medication belongs to a different client.' using errcode = '42501';
  end if;
  if not public.can_log_client_meds(v_med.client_id, v_uid) then
    raise exception 'You can''t chart medications for this client.' using errcode = '42501';
  end if;

  -- Offline retry: the same request id returns the row it already made.
  select * into v_existing from public.emar_logs where client_request_id = r.client_request_id;
  if found then
    if v_existing.staff_id is distinct from v_uid or v_existing.medication_id is distinct from r.medication_id then
      raise exception 'This request id was already used for another dose.' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  if not v_med.is_active or v_med.discontinued_at is not null then
    raise exception 'This medication has been stopped.' using errcode = '22023';
  end if;
  if v_med.paused_at is not null then
    raise exception 'This medication is paused.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.emar_logs e
    where e.medication_id = r.medication_id
      and e.scheduled_for = r.scheduled_for
      and e.status in ('administered', 'self_administered', 'given', 'refused', 'omitted', 'missed', 'held')
  ) then
    raise exception 'This dose has already been documented.' using errcode = '23505';
  end if;

  v_exception := r.exception_reason;
  v_taken_at := coalesce(r.actual_taken_at, r.administered_at, now());
  if v_med.is_prn and r.status = 'administered' then
    select max(coalesce(e.actual_taken_at, e.administered_at, e.scheduled_for)),
           count(*) filter (where coalesce(e.actual_taken_at, e.administered_at, e.scheduled_for) > v_taken_at - interval '24 hours')
      into v_last, v_count
    from public.emar_logs e
    where e.medication_id = r.medication_id
      and e.status in ('administered', 'self_administered', 'given')
      and coalesce(e.actual_taken_at, e.administered_at, e.scheduled_for) <= v_taken_at;
    if (v_med.prn_min_hours is not null and v_last is not null
          and v_last > v_taken_at - make_interval(secs => (v_med.prn_min_hours * 3600)::double precision))
       or (v_med.prn_max_per_day is not null and v_count >= v_med.prn_max_per_day) then
      if coalesce(btrim(_prn_override_reason), '') = '' then
        raise exception 'PRN_LIMIT: too soon or over the daily maximum for this as-needed medication.'
          using errcode = 'P0001';
      end if;
      v_exception := 'PRN limit override: ' || btrim(_prn_override_reason);
    end if;
  end if;

  insert into public.emar_logs (
    organization_id, client_id, medication_id, scheduled_for, scheduled_time_label,
    administered_at, actual_taken_at, status, administrator_role, credential_id,
    exception_reason, notes, staff_id, staff_name, signature_attestation,
    signature_data_url, attestation_signed, is_prn, prn_reason, is_controlled,
    pill_count_verified, pill_count_value, is_medication_error, error_description,
    seizure_duration_seconds, seizure_outcome, emergency_services_called,
    service_context, recorded_in, second_witness_id, source, scheduled_shift_id,
    route, prn_tried_first, prescriber_notified, prn_followup_due_at, client_request_id
  ) values (
    v_med.organization_id, v_med.client_id, v_med.id, r.scheduled_for, r.scheduled_time_label,
    r.administered_at, r.actual_taken_at, r.status, r.administrator_role, r.credential_id,
    v_exception, r.notes, v_uid, r.staff_name, r.signature_attestation,
    r.signature_data_url, coalesce(r.attestation_signed, false), v_med.is_prn, r.prn_reason, v_med.is_controlled,
    r.pill_count_verified, r.pill_count_value, coalesce(r.is_medication_error, false), r.error_description,
    r.seizure_duration_seconds, r.seizure_outcome, r.emergency_services_called,
    r.service_context, coalesce(r.recorded_in, 'general'), r.second_witness_id, coalesce(r.source, 'emar'), r.scheduled_shift_id,
    coalesce(r.route, v_med.route), r.prn_tried_first, r.prescriber_notified,
    case when v_med.is_prn and r.status = 'administered'
         then v_taken_at + make_interval(mins => coalesce(v_med.prn_followup_minutes, 60)) end,
    r.client_request_id
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.log_medication_dose(jsonb, text) from public, anon;
grant execute on function public.log_medication_dose(jsonb, text) to authenticated, service_role;
