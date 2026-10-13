-- Nectar rebuild N3: the required policies checklist (Decision 3). Additive only.
--
-- 1. required_policy_slots: the 10 policies DHHS91172 sections 1.17-1.23 ask
--    every agency to have. Codes are stored without the section sign; the
--    screens show it.
-- 2. Two agency answers that decide whether two of the slots apply:
--    provides_transportation (1.18(2),(7)) and manages_client_money (1.18(5)).

create table if not exists public.required_policy_slots (
  id text primary key,
  code text not null,
  label text not null,
  applies_when text check (applies_when in ('transport', 'finances')),
  position integer not null,
  created_at timestamptz not null default now()
);

comment on table public.required_policy_slots is
  'Required agency policies from DHHS91172 (Nectar rebuild N3). applies_when: transport = only if the agency provides transportation; finances = only if it manages clients'' personal money.';

insert into public.required_policy_slots (id, code, label, applies_when, position) values
  ('personnel_policies', '1.17(a)', 'Personnel policies', null, 1),
  ('job_descriptions', '1.17(b)', 'Job descriptions', null, 2),
  ('staff_supervisor_duties', '1.18(1)', 'Staff and supervisor duties', null, 3),
  ('transportation', '1.18(2),(7)', 'Transportation and driving record', 'transport', 4),
  ('grievances', '1.18(3)', 'Grievances', null, 5),
  ('emergencies', '1.18(4)', 'Emergencies, health decline and death', null, 6),
  ('personal_finances', '1.18(5)', 'Personal finances', 'finances', 7),
  ('behavior_supports', '1.18(6)', 'Behavior supports (R539-4)', null, 8),
  ('human_rights_plan', '1.21', 'Human rights plan', null, 9),
  ('health_medication', '1.23', 'Health and medication', null, 10)
on conflict (id) do nothing;

-- Reference data shared by every agency (no organization, no PHI): any
-- signed-in user may read it; nobody writes it outside migrations.
alter table public.required_policy_slots enable row level security;

create policy "signed-in users read required policy slots"
  on public.required_policy_slots
  for select
  to authenticated
  using (true);

alter table public.organizations
  add column if not exists provides_transportation boolean not null default true,
  add column if not exists manages_client_money boolean not null default false;

comment on column public.organizations.provides_transportation is
  'Required policies: the transportation and driving record slot (DHHS91172 1.18(2),(7)) applies only when true.';
comment on column public.organizations.manages_client_money is
  'Required policies: the personal finances slot (DHHS91172 1.18(5)) applies only when true.';
