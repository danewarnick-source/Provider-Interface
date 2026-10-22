-- Health tab: one column per field the Health tab edits that had none.
-- Additive only; RLS on clients already covers them.
alter table public.clients
  add column if not exists diets text[] not null default '{}'::text[],
  add column if not exists mobility text[] not null default '{}'::text[],
  add column if not exists emergency_plan text;

comment on column public.clients.diets is 'Special diets / eating needs (Health tab list). Swallowing stays in dysphagia + swallowing_alerts.';
comment on column public.clients.mobility is 'Mobility needs and equipment (Health tab list), e.g. wheelchair, walker, transfer help.';
comment on column public.clients.emergency_plan is 'What staff do in a medical emergency for this person (Health tab free text).';
