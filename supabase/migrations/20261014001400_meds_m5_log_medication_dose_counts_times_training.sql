-- Meds rebuild M5 (audit): log_medication_dose now also
--  * checks the time taken: not in the future (2 minutes of clock slack) and
--    not more than 24 hours back. The documented time is the server's now()
--    (documented_at default; the insert never sets it).
--  * checks medication training on the dose date (med_training_status) for a
--    given dose: 'not_current' is refused; 'approved' or 'not_set_up' is
--    stored on the dose (training_checked) so an agency without medication
--    training set up is never recorded as trained.
--  * requires a PRN reason for a given PRN.
--  * saves the dose and its pill-count change together. The count goes down
--    in one statement (pill_count_current = pill_count_current - 1 ...
--    RETURNING) and is never clamped at 0.
--  * controlled medications: the staff member's counts before and after come
--    in the dose (count_before, count_after); the expected count is read here
--    from the locked medication row, never sent by the browser. A mismatch,
--    a negative count or no count on file flags the controlled_med_counts row.
--    A hands-on controlled dose needs a witness confirmation
--    (witness_confirmation_id) made by the server after the witness signed
--    in: a different active agency member, unused, under 15 minutes old, for
--    this staff member and medication.
-- Extra inputs ride in _dose as keys that aren't emar_logs columns, so the
-- signature stays (jsonb, text).
create or replace function public.log_medication_dose(_dose jsonb, _prn_override_reason text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_med public.client_medications%rowtype;
  r public.emar_logs%rowtype;
  v_existing public.emar_logs%rowtype;
  v_taken boolean;
  v_taken_at timestamptz;
  v_last timestamptz;
  v_count int;
  v_exception text;
  v_training text;
  v_hands_on boolean;
  v_count_before int;
  v_count_after int;
  v_expected_before int;
  v_expected_after int;
  v_conf_id uuid;
  v_conf public.med_witness_confirmations%rowtype;
  v_flagged boolean;
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

  v_taken := r.status = 'administered';
  v_exception := r.exception_reason;
  v_taken_at := coalesce(r.actual_taken_at, r.administered_at, v_now);
  if v_taken then
    if v_taken_at > v_now + interval '2 minutes' then
      raise exception 'The time taken can''t be in the future.' using errcode = '22023';
    end if;
    if v_taken_at < v_now - interval '24 hours' then
      raise exception 'The time taken can''t be more than 24 hours ago.' using errcode = '22023';
    end if;
    r.actual_taken_at := v_taken_at;
    r.administered_at := v_taken_at;

    v_training := public.med_training_status(v_uid, v_med.organization_id, (v_taken_at at time zone 'America/Denver')::date);
    if v_training is distinct from 'approved' and v_training is distinct from 'not_set_up' then
      raise exception 'TRAINING: Your medication training isn''t approved or has expired. Ask an admin before giving medications.'
        using errcode = '42501';
    end if;

    if v_med.is_prn and coalesce(btrim(r.prn_reason), '') = '' then
      raise exception 'Add why the as-needed medication was given.' using errcode = '22023';
    end if;
  else
    r.actual_taken_at := null;
    r.administered_at := null;
  end if;

  if v_med.is_prn and v_taken then
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

  -- Controlled: counts before and after, witness for hands-on doses.
  if v_med.is_controlled and v_taken then
    v_count_before := nullif(_dose ->> 'count_before', '')::int;
    v_count_after := nullif(_dose ->> 'count_after', '')::int;
    if v_count_before is null or v_count_after is null then
      raise exception 'Count the medication before and after the dose.' using errcode = '22023';
    end if;
    v_hands_on := coalesce(r.administrator_role, '') in ('staff_administered', 'lpn', 'rn', 'delegated')
      or coalesce(v_med.how_taken, '') in ('assist', 'nurse');
    v_conf_id := nullif(_dose ->> 'witness_confirmation_id', '')::uuid;
    if v_hands_on and v_conf_id is null then
      raise exception 'A witness needs to sign in to confirm this count.' using errcode = '22023';
    end if;
    if v_conf_id is not null then
      select * into v_conf from public.med_witness_confirmations c
      where c.id = v_conf_id
      for update;
      if not found
         or v_conf.used_at is not null
         or v_conf.requested_by <> v_uid
         or v_conf.medication_id <> v_med.id
         or v_conf.witness_id = v_uid
         or v_conf.confirmed_at < v_now - interval '15 minutes'
         or not exists (
           select 1 from public.organization_members om
           where om.organization_id = v_med.organization_id
             and om.user_id = v_conf.witness_id
             and coalesce(om.active, true)
             and om.deleted_at is null
         )
      then
        raise exception 'The witness sign-in has expired or isn''t valid. Ask the witness to sign in again.'
          using errcode = '42501';
      end if;
      r.second_witness_id := v_conf.witness_id;
      r.witness_confirmed_at := v_conf.confirmed_at;
    else
      r.second_witness_id := null;
      r.witness_confirmed_at := null;
    end if;
  else
    r.second_witness_id := null;
    r.witness_confirmed_at := null;
  end if;

  v_expected_before := v_med.pill_count_current;

  insert into public.emar_logs (
    organization_id, client_id, medication_id, scheduled_for, scheduled_time_label,
    administered_at, actual_taken_at, status, administrator_role, credential_id,
    exception_reason, notes, staff_id, staff_name, signature_attestation,
    signature_data_url, attestation_signed, is_prn, prn_reason, is_controlled,
    pill_count_verified, pill_count_value, is_medication_error, error_description,
    seizure_duration_seconds, seizure_outcome, emergency_services_called,
    service_context, recorded_in, second_witness_id, witness_confirmed_at, source, scheduled_shift_id,
    route, prn_tried_first, prescriber_notified, prn_followup_due_at, training_checked, client_request_id
  ) values (
    v_med.organization_id, v_med.client_id, v_med.id, r.scheduled_for, r.scheduled_time_label,
    r.administered_at, r.actual_taken_at, r.status, r.administrator_role, r.credential_id,
    v_exception, r.notes, v_uid, r.staff_name, r.signature_attestation,
    r.signature_data_url, coalesce(r.attestation_signed, false), v_med.is_prn, r.prn_reason, v_med.is_controlled,
    case when v_count_before is not null then true end, v_count_before,
    coalesce(r.is_medication_error, false), r.error_description,
    r.seizure_duration_seconds, r.seizure_outcome, r.emergency_services_called,
    r.service_context, coalesce(r.recorded_in, 'general'), r.second_witness_id, r.witness_confirmed_at,
    coalesce(r.source, 'emar'), r.scheduled_shift_id,
    coalesce(r.route, v_med.route), r.prn_tried_first, r.prescriber_notified,
    case when v_med.is_prn and v_taken
         then v_taken_at + make_interval(mins => coalesce(v_med.prn_followup_minutes, 60)) end,
    case when v_taken then v_training end,
    r.client_request_id
  )
  returning id into v_id;

  -- Inventory: the dose and its count change commit together.
  if v_taken and v_med.pill_count_current is not null then
    update public.client_medications
       set pill_count_current = pill_count_current - 1,
           pill_count_updated_at = v_now,
           refill_status = case
             when refill_status = 'ok' and pill_count_current - 1 <= coalesce(refill_threshold, 7) then 'pending'
             else refill_status
           end
     where id = v_med.id
    returning pill_count_current into v_expected_after;
  end if;

  if v_med.is_controlled and v_taken then
    v_flagged := v_expected_before is null
      or v_count_before <> v_expected_before
      or v_expected_after is null
      or v_count_after <> v_expected_after
      or v_expected_after < 0
      or v_count_after < 0;
    insert into public.controlled_med_counts (
      organization_id, client_id, medication_id, emar_log_id, context,
      expected_count, counted_value, count_after, expected_after, flagged,
      staff_id, staff_name, signature_data_url, notes, witness_id, witness_confirmed_at
    ) values (
      v_med.organization_id, v_med.client_id, v_med.id, v_id, 'pass',
      v_expected_before, v_count_before,
      v_count_after, v_expected_after, v_flagged,
      v_uid, r.staff_name, r.signature_data_url,
      case when v_expected_before is null then 'No count on file for this medication.' end,
      r.second_witness_id, r.witness_confirmed_at
    );
  end if;

  if v_conf_id is not null and r.second_witness_id is not null then
    update public.med_witness_confirmations
       set used_at = v_now, emar_log_id = v_id
     where id = v_conf_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.log_medication_dose(jsonb, text) from public, anon;
grant execute on function public.log_medication_dose(jsonb, text) to authenticated, service_role;
