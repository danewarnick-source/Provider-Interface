-- Clients rebuild P11 follow-up: the discharge takes the team off the client in
-- the same transaction (additive: replaces one function, same signature).
--
-- discharge_client used to snapshot the team (staff_assignments) into
-- ended_items and leave the removal to the server function after it returned,
-- so a discharge could commit with the team still assigned. It now removes the
-- client's staff_assignments rows right after the snapshot, inside the
-- function: the discharge and the team removal succeed or fail together. The
-- snapshot in client_discharges.ended_items keeps who was on the team.
-- staff_assignments has no triggers and nothing references it, so the delete
-- has no side effects. Everything else is unchanged from 20261006230100.

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
  -- The team comes off the client in this transaction (snapshot above keeps it).
  delete from public.staff_assignments
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
