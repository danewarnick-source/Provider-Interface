-- Clients rebuild P11: discharge and reactivate as one transaction each
-- (additive only: new functions, plus one early-return in the shift guard).
--
-- client_discharge_preview(_client, _discharge_date): what a discharge on that
--   date would end — authorizations that are active on the date, the team
--   (staff_assignments), and future shifts — plus authorizations that start
--   after the date (left as they are). Read-only.
-- discharge_client(...): records the discharge in client_discharges, ends the
--   active authorizations on the discharge date (service_end_date; rows are
--   kept), snapshots the team (staff_assignments) into ended_items, cancels
--   shifts that start after the discharge date (and after now), and moves the
--   client to Discharged (account_status 'archived', the value every existing
--   reader already treats as discharged). All or nothing. The server function
--   then takes the team off the client through the normal caseload path.
-- reactivate_client(_client): moves the client back to active and stamps the
--   open discharge row. History is not undone: authorizations stay ended,
--   cancelled shifts stay cancelled, the team is rebuilt by hand.
-- All three need Clients: Edit on a client the caller can see. They run as
--   SECURITY DEFINER so a scoped manager with Clients: Edit can finish the
--   discharge even where the table policies are admin-only.
-- scheduled_shifts_staff_update_guard: lets the discharge function cancel
--   unassigned shifts for a scoped manager (transaction-local flag that only
--   discharge_client sets). Unchanged otherwise.

create or replace function public.client_discharge_assert(_client uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.clients where id = _client;
  if v_org is null then
    raise exception 'Client not found in this organization' using errcode = 'P0002';
  end if;
  if auth.uid() is null
     or not public.access_has_category(v_org, auth.uid(), 'clients', 'edit')
     or not public.access_can_see_client(_client, auth.uid()) then
    raise exception 'You don''t have permission to change this' using errcode = '42501';
  end if;
  return v_org;
end;
$$;

create or replace function public.client_discharge_cutoff(_discharge_date date)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select greatest(now(), ((_discharge_date + 1)::timestamp at time zone 'America/Denver'));
$$;

create or replace function public.client_discharge_preview(_client uuid, _discharge_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.client_discharge_assert(_client);
  v_cutoff timestamptz := public.client_discharge_cutoff(_discharge_date);
begin
  return jsonb_build_object(
    'authorizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'service_code', service_code,
        'service_end_date', service_end_date) order by service_code)
      from public.client_billing_codes
      where organization_id = v_org and client_id = _client
        and (service_end_date is null or service_end_date > _discharge_date)
        and (service_start_date is null or service_start_date <= _discharge_date)
    ), '[]'::jsonb),
    'upcoming_authorizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'service_code', service_code,
        'service_start_date', service_start_date) order by service_code)
      from public.client_billing_codes
      where organization_id = v_org and client_id = _client
        and service_start_date > _discharge_date
    ), '[]'::jsonb),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', staff_id, 'service_codes', service_codes))
      from public.staff_assignments
      where organization_id = v_org and client_id = _client
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at, 'staff_id', staff_id,
        'service_code', coalesce(service_code, job_code)) order by starts_at)
      from public.scheduled_shifts
      where organization_id = v_org and client_id = _client
        and starts_at >= v_cutoff and status <> 'cancelled'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.discharge_client(
  _client uuid,
  _discharge_date date,
  _reason text,
  _initiated_by text,
  _notice_date date,
  _summary_text text,
  _summary_drafted_by_nectar boolean,
  _summary_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.client_discharge_assert(_client);
  v_status text;
  v_cutoff timestamptz := public.client_discharge_cutoff(_discharge_date);
  v_auth jsonb;
  v_team jsonb;
  v_shifts jsonb;
  v_summary text := nullif(btrim(coalesce(_summary_text, '')), '');
  v_id uuid;
begin
  if _discharge_date is null then raise exception 'Pick a discharge date.'; end if;
  if nullif(btrim(coalesce(_reason, '')), '') is null then raise exception 'Say why the client is being discharged.'; end if;
  if _initiated_by is null or _initiated_by not in ('agency', 'person', 'dspd') then
    raise exception 'Say who started the discharge.';
  end if;
  if _notice_date is not null and _notice_date > _discharge_date then
    raise exception 'The notice date can''t be after the discharge date.';
  end if;
  if coalesce(_summary_confirmed, false) and v_summary is null then
    raise exception 'There is no summary to confirm.';
  end if;

  select account_status into v_status from public.clients where id = _client for update;
  if v_status in ('archived', 'discharged') then
    raise exception 'This client is already discharged.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'service_code', service_code,
    'previous_end_date', service_end_date) order by service_code), '[]'::jsonb)
    into v_auth
    from public.client_billing_codes
    where organization_id = v_org and client_id = _client
      and (service_end_date is null or service_end_date > _discharge_date)
      and (service_start_date is null or service_start_date <= _discharge_date);
  update public.client_billing_codes
    set service_end_date = _discharge_date
    where organization_id = v_org and client_id = _client
      and (service_end_date is null or service_end_date > _discharge_date)
      and (service_start_date is null or service_start_date <= _discharge_date);

  select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'service_codes', service_codes,
    'is_group_home_assignment', is_group_home_assignment)), '[]'::jsonb)
    into v_team
    from public.staff_assignments
    where organization_id = v_org and client_id = _client;

  perform set_config('hive.client_discharge', 'on', true);
  with cancelled as (
    update public.scheduled_shifts
      set status = 'cancelled'
      where organization_id = v_org and client_id = _client
        and starts_at >= v_cutoff and status <> 'cancelled'
      returning id, starts_at, staff_id, status
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at,
    'staff_id', staff_id) order by starts_at), '[]'::jsonb)
    into v_shifts from cancelled;
  perform set_config('hive.client_discharge', 'off', true);

  update public.clients
    set account_status = 'archived', discharge_date = _discharge_date
    where id = _client;

  insert into public.client_discharges (
    organization_id, client_id, discharge_date, reason, initiated_by, notice_date,
    summary_text, summary_drafted_by_nectar, summary_confirmed_at, summary_confirmed_by,
    ended_items, created_by
  ) values (
    v_org, _client, _discharge_date, btrim(_reason), _initiated_by, _notice_date,
    v_summary, coalesce(_summary_drafted_by_nectar, false) and v_summary is not null,
    case when coalesce(_summary_confirmed, false) then now() end,
    case when coalesce(_summary_confirmed, false) then auth.uid() end,
    jsonb_build_object('authorizations', v_auth, 'team', v_team, 'shifts', v_shifts),
    auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.reactivate_client(_client uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.client_discharge_assert(_client);
  v_status text;
begin
  select account_status into v_status from public.clients where id = _client for update;
  if v_status is null or v_status not in ('archived', 'discharged') then
    raise exception 'This client is already active.';
  end if;
  update public.clients
    set account_status = 'active', discharge_date = null
    where id = _client;
  update public.client_discharges
    set reactivated_at = now(), reactivated_by = auth.uid()
    where organization_id = v_org and client_id = _client and reactivated_at is null;
end;
$$;

revoke all on function public.client_discharge_assert(uuid) from public, anon;
revoke all on function public.client_discharge_cutoff(date) from public, anon;
revoke all on function public.client_discharge_preview(uuid, date) from public, anon;
revoke all on function public.discharge_client(uuid, date, text, text, date, text, boolean, boolean) from public, anon;
revoke all on function public.reactivate_client(uuid) from public, anon;
grant execute on function public.client_discharge_assert(uuid) to authenticated;
grant execute on function public.client_discharge_cutoff(date) to authenticated;
grant execute on function public.client_discharge_preview(uuid, date) to authenticated;
grant execute on function public.discharge_client(uuid, date, text, text, date, text, boolean, boolean) to authenticated;
grant execute on function public.reactivate_client(uuid) to authenticated;

create or replace function public.scheduled_shifts_staff_update_guard()
returns trigger
language plpgsql
set search_path = public
as $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text[] := ARRAY['status','notes','staff_id','claim_requested_by','published','updated_at'];
BEGIN
  IF v_uid IS NULL OR public.is_org_admin_or_manager(OLD.organization_id, v_uid) THEN
    RETURN NEW;
  END IF;
  -- discharge_client cancels the client's future shifts (status only).
  IF current_setting('hive.client_discharge', true) = 'on'
     AND NEW.status = 'cancelled'
     AND (to_jsonb(NEW) - ARRAY['status','updated_at']) = (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
    RETURN NEW;
  END IF;
  -- Non-admin: only claim / respond columns may change.
  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'Only admins/managers can edit shift details' USING ERRCODE = '42501';
  END IF;
  -- Assignment is admin/manager-only. Staff request open shifts via claim_requested_by and wait for approval.
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'Only admins/managers can assign shifts; submit a claim for approval instead' USING ERRCODE = '42501';
  END IF;
  IF NEW.published IS DISTINCT FROM OLD.published THEN
    RAISE EXCEPTION 'Only admins/managers can publish shifts' USING ERRCODE = '42501';
  END IF;
  -- claim_requested_by may only be set to the caller when no claim is pending, or cleared by the claimant.
  IF NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     AND NOT ((NEW.claim_requested_by = v_uid AND OLD.claim_requested_by IS NULL)
              OR (NEW.claim_requested_by IS NULL AND OLD.claim_requested_by = v_uid)) THEN
    RAISE EXCEPTION 'Staff may only request a claim for themselves on an unclaimed shift' USING ERRCODE = '42501';
  END IF;
  -- On an unassigned shift a non-admin may only change the claim.
  IF OLD.staff_id IS NULL
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Only admins/managers can change an unassigned shift; submit a claim instead' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
