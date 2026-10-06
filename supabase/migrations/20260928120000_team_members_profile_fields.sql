-- Team members: DSPD profile fields for the one-screen Add team member flow.
--
-- Additive and compatible with main:
--   * transports_clients is new (default false), so existing writers are unaffected.
--   * worker_type widens from w2|1099 to w2|1099|volunteer|other. Live values are
--     only 'w2' and '1099', so the new check validates cleanly.
--   * requires_abi / requires_deescalation lose NOT NULL and their `true` default.
--     New team members leave them null ("not answered"); readers already treat
--     null like "applies" (staff-training-requirements: `!== false`). main writes
--     explicit booleans, so nothing it does changes.
--   * The retired custom_attributes.needs_setup flag (Finish setup) is cleared.

alter table public.profiles
  add column if not exists transports_clients boolean not null default false;

comment on column public.profiles.transports_clients is
  'Team member drives people we serve. Pre-fills the Evidence questionnaire transport answer.';

-- worker_type: normalize, then swap the w2|1099 check for the wider one.
update public.profiles
set worker_type = case
  when lower(btrim(worker_type)) in ('w2', 'w-2', 'w2 employee', 'employee') then 'w2'
  when lower(btrim(worker_type)) in ('1099', '1099 contractor', 'contractor') then '1099'
  when lower(btrim(worker_type)) = 'volunteer' then 'volunteer'
  else 'other'
end
where worker_type is distinct from 'w2'
  and worker_type is distinct from '1099'
  and worker_type is distinct from 'volunteer'
  and worker_type is distinct from 'other';

alter table public.profiles drop constraint if exists profiles_worker_type_chk;

alter table public.profiles
  add constraint profiles_worker_type_chk
  check (worker_type in ('w2', '1099', 'volunteer', 'other')) not valid;

alter table public.profiles validate constraint profiles_worker_type_chk;

alter table public.profiles alter column requires_abi drop not null;
alter table public.profiles alter column requires_abi drop default;
alter table public.profiles alter column requires_deescalation drop not null;
alter table public.profiles alter column requires_deescalation drop default;

update public.profiles
set custom_attributes = custom_attributes - 'needs_setup'
where custom_attributes ? 'needs_setup';
