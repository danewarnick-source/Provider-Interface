-- Clients polish C4: a plan's non-goal supports ("other needs in the PCSP")
-- are kept under one client_goals row marked kind = 'other_need', so support
-- strategies can be written for the ones paid to the agency.
-- Additive only: every existing row is a goal (the default).

alter table public.client_goals
  add column if not exists kind text not null default 'goal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_goals_kind_check' and conrelid = 'public.client_goals'::regclass
  ) then
    alter table public.client_goals
      add constraint client_goals_kind_check check (kind in ('goal', 'other_need'));
  end if;
end $$;

comment on column public.client_goals.kind is
  'goal = a PCSP goal; other_need = the row holding the plan''s non-goal supports ("Other needs in the PCSP").';
