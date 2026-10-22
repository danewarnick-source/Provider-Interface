-- Meds rebuild M5: PRN "Did it help?" follow-ups.
--
-- 1. notifications_type_check gains 'prn_followup_due' (relaxing the check).
-- 2. record_prn_followup saves the answer on the dose. Anyone who can chart
--    this client's medications can answer (the next shift may), once. A PRN
--    psychotropic also needs what was tried first and whether the nurse or
--    prescriber was told. It clears the follow-up notification.
-- 3. notify_prn_followups_due tells the staff member who gave the dose, in the
--    app only, once the follow-up is due. pg_cron runs it every 5 minutes.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'incident_report_filed', 'incident_deadline_warning', 'timesheet_exception', 'daily_log_exception',
  'open_shift_warning', 'medication_error', 'form_assigned', 'form_reminder', 'form_due',
  'staff_mandate_missing', 'smart_import_flag', 'smart_import_provisional_cert',
  'smart_import_unverified_cert', 'smart_import_cert_expiring', 'smart_import_question',
  'shift_published', 'shift_updated', 'time_off_requested', 'time_off_decided',
  'company_obligation_reminder', 'company_obligation_update', 'hive_training_class', 'escalation',
  'swap_request', 'swap_partner_accepted', 'swap_approved', 'swap_assigned', 'shift_claim_request',
  'shift_claim_approved', 'shift_claim_denied', 'shift_declined', 'shifts_published',
  'shift_changed', 'callout', 'prn_followup_due'
]::text[]));

create or replace function public.record_prn_followup(
  _log_id uuid,
  _effect text,
  _note text default null,
  _tried_first text default null,
  _prescriber_notified boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_log public.emar_logs%rowtype;
  v_psych boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if _effect is null or _effect not in ('helped', 'partly', 'no') then
    raise exception 'Pick whether it helped.' using errcode = '22023';
  end if;
  select * into v_log from public.emar_logs where id = _log_id for update;
  if not found then
    raise exception 'Dose not found.' using errcode = 'P0002';
  end if;
  if not public.can_log_client_meds(v_log.client_id, v_uid) then
    raise exception 'You can''t chart medications for this client.' using errcode = '42501';
  end if;
  if not coalesce(v_log.is_prn, false) or v_log.prn_followup_due_at is null then
    raise exception 'This dose has no follow-up.' using errcode = '22023';
  end if;
  if v_log.prn_followup_at is not null then
    raise exception 'The follow-up for this dose is already saved.' using errcode = '23505';
  end if;
  select coalesce(m.is_psychotropic, false) into v_psych
    from public.client_medications m where m.id = v_log.medication_id;
  if v_psych then
    if coalesce(btrim(coalesce(_tried_first, v_log.prn_tried_first)), '') = '' then
      raise exception 'Add what was tried first.' using errcode = '22023';
    end if;
    if coalesce(_prescriber_notified, v_log.prescriber_notified) is null then
      raise exception 'Say whether the nurse or prescriber was told.' using errcode = '22023';
    end if;
  end if;

  update public.emar_logs
     set prn_effect = _effect,
         prn_followup_at = now(),
         prn_followup_by = v_uid,
         prn_followup_note = nullif(btrim(_note), ''),
         prn_tried_first = coalesce(nullif(btrim(_tried_first), ''), prn_tried_first),
         prescriber_notified = coalesce(_prescriber_notified, prescriber_notified)
   where id = _log_id;

  update public.notifications
     set resolved_at = now(), resolved_by = v_uid, read_at = coalesce(read_at, now())
   where type = 'prn_followup_due' and related_id = _log_id and resolved_at is null;
end;
$$;
revoke all on function public.record_prn_followup(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.record_prn_followup(uuid, text, text, text, boolean) to authenticated, service_role;

create or replace function public.notify_prn_followups_due()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  insert into public.notifications (
    organization_id, recipient_role, recipient_user_id, type, urgency, title, body,
    link_to, related_id, related_type
  )
  select e.organization_id, 'staff', e.staff_id, 'prn_followup_due', 'high',
         'PRN follow-up due',
         'Did ' || coalesce(m.medication_name, 'the as-needed medication') || ' help '
           || coalesce(c.first_name, 'the client') || '? Record it in Give meds.',
         '/dashboard/workspace/' || e.client_id || '?tab=emar',
         e.id, 'emar_log'
    from public.emar_logs e
    join public.client_medications m on m.id = e.medication_id
    join public.clients c on c.id = e.client_id
   where e.prn_followup_due_at is not null
     and e.prn_followup_at is null
     and e.prn_followup_due_at <= now()
     and e.prn_followup_due_at > now() - interval '24 hours'
     and e.staff_id is not null
     and not exists (
       select 1 from public.notifications n
        where n.type = 'prn_followup_due' and n.related_id = e.id
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.notify_prn_followups_due() from public, anon, authenticated;

select cron.schedule('prn-followup-due', '*/5 * * * *', 'select public.notify_prn_followups_due()');
