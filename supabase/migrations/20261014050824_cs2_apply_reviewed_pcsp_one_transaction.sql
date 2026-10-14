-- Confirming a reviewed PCSP writes everything in one transaction: retire the
-- old current plan, insert the new plan, its goals and supports, upsert the
-- service codes, fill blank profile fields and add contacts. A failure part
-- way through rolls all of it back, so the old plan stays current.
--
-- Called by the server functions (applyReviewedPcsp) after their own
-- assertCanManageClient checks. It re-checks here because it is SECURITY
-- DEFINER: with a signed-in caller the actor is auth.uid() (and _actor must
-- match); with a trusted server client (no auth.uid(), service_role only —
-- anon and PUBLIC cannot execute it) the actor is _actor.

create or replace function public.apply_reviewed_pcsp(
  _organization_id uuid,
  _client_id uuid,
  _actor uuid,
  _document_id uuid,
  _plan jsonb,
  _goals jsonb,
  _codes jsonb,
  _client_patch jsonb,
  _contacts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_client public.clients%rowtype;
  v_status text := coalesce(_plan->>'status', 'current');
  v_plan uuid;
  v_goal uuid;
  g record;
begin
  if v_uid is null then
    if _actor is null then
      raise exception 'Not signed in.' using errcode = '42501';
    end if;
    v_uid := _actor;
  elsif _actor is not null and _actor <> v_uid then
    raise exception 'You don''t have permission to change this' using errcode = '42501';
  end if;

  select * into v_client from public.clients
    where id = _client_id and organization_id = _organization_id
    for update;
  if not found or v_client.deleted_at is not null then
    raise exception 'Client not found in this organization' using errcode = 'P0002';
  end if;
  if v_client.account_status in ('archived', 'discharged') then
    raise exception 'This client is discharged, so their record is read-only. Reactivate them to make changes.'
      using errcode = '42501';
  end if;
  if not public.access_has_category(_organization_id, v_uid, 'clients', 'edit')
     or not public.access_can_see_client(_client_id, v_uid) then
    raise exception 'You don''t have permission to change this' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(_codes, '[]'::jsonb)) > 0
     and not public.access_has_category(_organization_id, v_uid, 'billing', 'edit') then
    raise exception 'You don''t have permission to change this' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.client_documents d
    where d.id = _document_id and d.client_id = _client_id and d.organization_id = _organization_id
      and lower(d.document_type) = 'pcsp'
  ) then
    raise exception 'That PCSP upload wasn''t found for this client. Upload it again.';
  end if;
  if v_status not in ('upcoming', 'current', 'ended') then
    raise exception 'Unknown plan status.';
  end if;

  -- Plan year (a new current plan retires the old one; nothing is deleted).
  if v_status = 'current' then
    update public.client_plans set status = 'past'
      where client_id = _client_id and status = 'current';
  end if;
  insert into public.client_plans (
    organization_id, client_id, start_date, end_date, status, activated_on, meeting_date,
    source, created_by, document_id
  ) values (
    _organization_id, _client_id,
    nullif(_plan->>'start_date', '')::date, nullif(_plan->>'end_date', '')::date, v_status,
    nullif(_plan->>'activated_on', '')::date, nullif(_plan->>'meeting_date', '')::date,
    'pcsp_upload', v_uid, _document_id
  ) returning id into v_plan;

  -- Goals and their supports, in order. A carried-over goal must be this client's.
  for g in
    select value as goal, (ordinality - 1)::int as sort
    from jsonb_array_elements(coalesce(_goals, '[]'::jsonb)) with ordinality
  loop
    insert into public.client_goals (
      organization_id, client_id, plan_id, sort, created_by, goal_text, kind, domain,
      current_status, strengths, barriers, success_person, success_team, carried_from_goal_id
    ) values (
      _organization_id, _client_id, v_plan, g.sort, v_uid,
      g.goal->>'goal_text', coalesce(g.goal->>'kind', 'goal'), g.goal->>'domain',
      g.goal->>'current_status', g.goal->>'strengths', g.goal->>'barriers',
      g.goal->>'success_person', g.goal->>'success_team',
      (select cg.id from public.client_goals cg
         where cg.id = nullif(g.goal->>'carried_from_goal_id', '')::uuid and cg.client_id = _client_id)
    ) returning id into v_goal;

    insert into public.client_goal_supports (
      organization_id, goal_id, sort, support_text, details, start_date, end_date,
      our_codes, other_providers, health_needs
    )
    select _organization_id, v_goal, (s.ordinality - 1)::int,
      coalesce(s.value->>'support_text', ''), s.value->>'details',
      nullif(s.value->>'start_date', '')::date, nullif(s.value->>'end_date', '')::date,
      coalesce(array(select jsonb_array_elements_text(coalesce(s.value->'our_codes', '[]'::jsonb))), '{}'),
      coalesce(s.value->'other_providers', '[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(s.value->'health_needs', '[]'::jsonb))), '{}')
    from jsonb_array_elements(coalesce(g.goal->'supports', '[]'::jsonb)) with ordinality as s(value, ordinality);
  end loop;

  -- Service codes (the caller holds them back without Billing: Edit).
  insert into public.client_billing_codes (
    organization_id, client_id, service_code, unit_type, rate_per_unit, annual_unit_authorization,
    monthly_max_units, service_start_date, service_end_date, rate_source, rate_source_document_id,
    rate_source_at, authorization_pending
  )
  select _organization_id, _client_id, upper(btrim(c->>'service_code')), c->>'unit_type',
    (c->>'rate_per_unit')::numeric, (c->>'annual_unit_authorization')::int,
    nullif(c->>'monthly_max_units', '')::int,
    nullif(c->>'service_start_date', '')::date, nullif(c->>'service_end_date', '')::date,
    c->>'rate_source', nullif(c->>'rate_source_document_id', '')::uuid,
    nullif(c->>'rate_source_at', '')::timestamptz, coalesce((c->>'authorization_pending')::boolean, false)
  from jsonb_array_elements(coalesce(_codes, '[]'::jsonb)) as c
  on conflict (organization_id, client_id, service_code) do update set
    unit_type = excluded.unit_type,
    rate_per_unit = excluded.rate_per_unit,
    annual_unit_authorization = excluded.annual_unit_authorization,
    monthly_max_units = excluded.monthly_max_units,
    service_start_date = excluded.service_start_date,
    service_end_date = excluded.service_end_date,
    rate_source = excluded.rate_source,
    rate_source_document_id = excluded.rate_source_document_id,
    rate_source_at = excluded.rate_source_at,
    authorization_pending = excluded.authorization_pending;

  -- Profile: fill blank fields only (a value someone typed is kept).
  if coalesce(_client_patch, '{}'::jsonb) <> '{}'::jsonb then
    update public.clients set
      client_pid = coalesce(nullif(btrim(client_pid), ''), nullif(btrim(_client_patch->>'client_pid'), '')),
      date_of_birth = coalesce(date_of_birth, nullif(_client_patch->>'date_of_birth', '')::date),
      phone_number = coalesce(nullif(btrim(phone_number), ''), nullif(btrim(_client_patch->>'phone_number'), '')),
      physical_address = coalesce(nullif(btrim(physical_address), ''), nullif(btrim(_client_patch->>'physical_address'), ''))
    where id = _client_id;
  end if;

  -- Support coordinator and other-provider contacts.
  insert into public.client_contacts (
    organization_id, client_id, role, name, phone, email, company, notes, is_primary, sort, created_by
  )
  select _organization_id, _client_id, k->>'role', k->>'name', k->>'phone', k->>'email',
    k->>'company', k->>'notes', coalesce((k->>'is_primary')::boolean, false),
    coalesce((k->>'sort')::int, 0), v_uid
  from jsonb_array_elements(coalesce(_contacts, '[]'::jsonb)) as k;

  return v_plan;
end;
$$;

revoke all on function public.apply_reviewed_pcsp(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.apply_reviewed_pcsp(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;
