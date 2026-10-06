-- Sandbox Agency: a fake agency in the live database for testing on the
-- Vercel sandbox (agency-peace-of-mind.vercel.app). Every name, address and
-- Medicaid ID below is invented. Never put real client data in this org.
--
-- Data only, not a migration: run it by hand against the live project.
--   psql "$DATABASE_URL" -v sandbox_password='…' -f scripts/sandbox/seed-sandbox-agency.sql
-- Re-running is safe: it adds whatever is missing and changes nothing else.
--
-- Logins are danewarnick+sbx-*@gmail.com, all with the one sandbox password.
-- The org owners (danewarnick@gmail.com, admin@tnsutah.com) are added as
-- owners and reach it through the org switcher; True North stays their default.

select set_config('sandbox.password', :'sandbox_password', false);

do $seed$
declare
  v_password text := current_setting('sandbox.password');
  v_org uuid;
  v_maple uuid;
  v_cedar uuid;
  v_host_home uuid;
  v_user uuid;
  v_client uuid;
  v_staff record;
  v_home record;
  v_client_row record;
  v_auth record;
  v_assign record;
begin
  if coalesce(length(v_password), 0) < 12 then
    raise exception 'sandbox_password must be at least 12 characters';
  end if;

  select id into v_org from organizations where slug = 'sandbox-agency';
  if v_org is null then
    insert into organizations (name, slug, legal_name, display_acronym, state_code, is_demo,
                               billing_exempt, setup_create_gate_exempt, services_offered, go_live_date)
    values ('Sandbox Agency', 'sandbox-agency', 'Sandbox Agency (fake data)', 'SBX', 'UT', true,
            true, true, array['HHS','RHS','DSI','SEI','SLH'], date '2026-07-01')
    returning id into v_org;
  end if;

  -- Owners first: the first member of an org skips the setup gate.
  insert into organization_members (organization_id, user_id, access_level, access_scope, job_title)
  select v_org, u.id, 'owner', 'agency', 'Owner'
  from auth.users u
  where u.email in ('danewarnick@gmail.com', 'admin@tnsutah.com')
    and not exists (select 1 from organization_members m
                    where m.organization_id = v_org and m.user_id = u.id);

  -- Homes
  for v_home in
    select * from (values
      ('Maple House', 'residential', 'group_home', 3, '100 Maple St, Sandy, UT 84070', '#2E7D32'),
      ('Cedar House', 'residential', 'group_home', 2, '200 Cedar Ave, Murray, UT 84107', '#1565C0'),
      ('Nguyen Host Home', 'host_home', 'other', 1, '300 Birch Ln, Draper, UT 84020', '#8E24AA')
    ) as h(team_name, setting, team_type, capacity, address, color)
  loop
    if not exists (select 1 from teams where organization_id = v_org and team_name = v_home.team_name) then
      insert into teams (organization_id, team_name, setting, team_type, capacity, address, color, active)
      values (v_org, v_home.team_name, v_home.setting, v_home.team_type, v_home.capacity,
              v_home.address, v_home.color, true);
    end if;
  end loop;
  select id into v_maple from teams where organization_id = v_org and team_name = 'Maple House';
  select id into v_cedar from teams where organization_id = v_org and team_name = 'Cedar House';
  select id into v_host_home from teams where organization_id = v_org and team_name = 'Nguyen Host Home';

  -- Staff logins
  for v_staff in
    select * from (values
      ('danewarnick+sbx-pm@gmail.com',   'Sam',    'Rivera', 'admin', 'program_manager', 'Admin',       array['program_manager'], 'Program Manager'),
      ('danewarnick+sbx-hm@gmail.com',   'Jordan', 'Lee',    'admin', 'home_manager',    'Admin',       array['house_manager'],   'Group Home Manager'),
      ('danewarnick+sbx-dsp1@gmail.com', 'Taylor', 'Brooks', 'staff', 'dsp',             'Direct Care', array['dsp'],             'DSP'),
      ('danewarnick+sbx-dsp2@gmail.com', 'Morgan', 'Diaz',   'staff', 'dsp',             'Direct Care', array['dsp'],             'DSP'),
      ('danewarnick+sbx-host@gmail.com', 'Casey',  'Nguyen', 'staff', 'dsp',             'Host Staff',  array['hhp'],             'Host Home Provider')
    ) as s(email, first_name, last_name, access_level, preset_key, position, staff_type_keys, job_title)
  loop
    select id into v_user from auth.users where email = v_staff.email;
    if v_user is null then
      v_user := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
              v_staff.email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('full_name', v_staff.first_name || ' ' || v_staff.last_name),
              now(), now(), '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (v_user::text, v_user,
              jsonb_build_object('sub', v_user::text, 'email', v_staff.email, 'email_verified', true),
              'email', now(), now(), now());
    end if;

    update profiles set
      first_name = v_staff.first_name,
      last_name = v_staff.last_name,
      full_name = v_staff.first_name || ' ' || v_staff.last_name,
      position = v_staff.position,
      staff_type_keys = v_staff.staff_type_keys,
      worker_type = 'w2',
      account_status = 'active',
      is_active = true,
      must_change_password = false,
      hire_date = coalesce(hire_date, date '2026-06-01'),
      start_date = coalesce(start_date, date '2026-06-01')
    where id = v_user;

    if not exists (select 1 from organization_members where organization_id = v_org and user_id = v_user) then
      insert into organization_members (organization_id, user_id, access_level, access_preset_id, job_title)
      values (v_org, v_user, v_staff.access_level::access_level,
              (select id from access_presets where organization_id = v_org and seed_key = v_staff.preset_key),
              v_staff.job_title);
    end if;
  end loop;

  -- The Group Home Manager only sees Maple House.
  insert into access_assignments (organization_id, user_id, kind, target_id)
  select v_org, u.id, 'home', v_maple from auth.users u
  where u.email = 'danewarnick+sbx-hm@gmail.com'
  on conflict (organization_id, user_id, kind, target_id) do nothing;

  -- Clients
  for v_client_row in
    select * from (values
      ('Avery',   'Sample',      date '1991-03-14', 'SBX0000001', v_maple,     true,  null::text,     null::text,       'complete',    '1:1'),
      ('Blake',   'Example',     date '1986-11-02', 'SBX0000002', v_maple,     false, 'Pat Example',  '801-555-0102',   'complete',    null),
      ('Charlie', 'Demo',        date '1999-07-21', 'SBX0000003', v_cedar,     true,  null,           null,             'complete',    null),
      ('Dakota',  'Placeholder', date '1978-01-30', 'SBX0000004', v_host_home, false, 'Lee Placeholder','801-555-0104', 'complete',    null),
      ('Emerson', 'Testcase',    date '2003-05-09', 'SBX0000005', null::uuid,  true,  null,           null,             'in_progress', null)
    ) as c(first_name, last_name, dob, medicaid_id, team_id, own_guardian, guardian_name, guardian_phone, intake_status, staff_ratio)
  loop
    if not exists (select 1 from clients where organization_id = v_org and medicaid_id = v_client_row.medicaid_id) then
      insert into clients (organization_id, first_name, last_name, date_of_birth, medicaid_id, team_id,
                           is_own_guardian, guardian_name, guardian_phone, guardian_relationship,
                           intake_status, staff_ratio, account_status, physical_address,
                           plan_year, admission_date, hive_start_date)
      values (v_org, v_client_row.first_name, v_client_row.last_name, v_client_row.dob,
              v_client_row.medicaid_id, v_client_row.team_id, v_client_row.own_guardian,
              v_client_row.guardian_name, v_client_row.guardian_phone,
              case when v_client_row.guardian_name is null then null else 'Parent' end,
              v_client_row.intake_status, v_client_row.staff_ratio, 'active',
              coalesce((select address from teams where id = v_client_row.team_id), '400 Aspen Way, Sandy, UT 84070'),
              '2026-2027', date '2026-07-01', date '2026-07-01');
    end if;
  end loop;

  -- Authorizations (the "1056"): no row here means no shifts and no billing for that code.
  for v_auth in
    select * from (values
      ('SBX0000001', 'RHS', 'day',    245.00, 365),
      ('SBX0000001', 'DSI', '15 min',   8.81, 2000),
      ('SBX0000002', 'RHS', 'day',    245.00, 365),
      ('SBX0000002', 'SEI', '15 min',  13.53, 600),
      ('SBX0000003', 'SLH', '15 min',   9.31, 2361),
      ('SBX0000003', 'DSI', '15 min',   8.81, 1000),
      ('SBX0000004', 'HHS', 'day',    276.08, 365),
      ('SBX0000004', 'SEI', '15 min',  13.53, 400),
      ('SBX0000005', 'SLH', '15 min',   9.31, 1200)
    ) as a(medicaid_id, code, unit_type, rate, annual_units)
  loop
    select id into v_client from clients where organization_id = v_org and medicaid_id = v_auth.medicaid_id;
    if not exists (select 1 from client_billing_codes where client_id = v_client and service_code = v_auth.code) then
      insert into client_billing_codes (organization_id, client_id, service_code, unit_type, rate_per_unit,
                                        annual_unit_authorization, service_start_date, service_end_date,
                                        authorization_pending)
      values (v_org, v_client, v_auth.code, v_auth.unit_type, v_auth.rate, v_auth.annual_units,
              date '2026-07-01', date '2027-06-30', false);
    end if;
  end loop;

  -- Who works with whom, per code.
  for v_assign in
    select * from (values
      ('danewarnick+sbx-dsp1@gmail.com', 'SBX0000001', array['RHS','DSI']),
      ('danewarnick+sbx-dsp1@gmail.com', 'SBX0000002', array['RHS']),
      ('danewarnick+sbx-dsp1@gmail.com', 'SBX0000004', array['SEI']),
      ('danewarnick+sbx-dsp2@gmail.com', 'SBX0000002', array['RHS','SEI']),
      ('danewarnick+sbx-dsp2@gmail.com', 'SBX0000003', array['SLH','DSI']),
      ('danewarnick+sbx-dsp2@gmail.com', 'SBX0000005', array['SLH']),
      ('danewarnick+sbx-host@gmail.com', 'SBX0000004', array['HHS'])
    ) as x(email, medicaid_id, codes)
  loop
    select id into v_user from auth.users where email = v_assign.email;
    select id into v_client from clients where organization_id = v_org and medicaid_id = v_assign.medicaid_id;
    if not exists (select 1 from staff_assignments where staff_id = v_user and client_id = v_client) then
      insert into staff_assignments (organization_id, staff_id, client_id, service_codes)
      values (v_org, v_user, v_client, v_assign.codes);
    end if;
  end loop;
end
$seed$;
