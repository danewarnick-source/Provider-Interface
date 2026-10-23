-- Why a client has an extra EVV service location (Day program, Job site,
-- Family home, Respite, School, Medical, Other) and, for Other, a short note.
-- Additive and nullable: existing locations keep no reason; the app requires
-- one whenever a location is added or edited.
alter table public.client_approved_locations
  add column if not exists reason text,
  add column if not exists reason_note text;

comment on column public.client_approved_locations.reason is
  'Why staff clock in here: day_program, job_site, family_home, respite, school, medical, other. Null on rows added before reasons existed.';
comment on column public.client_approved_locations.reason_note is
  'Short note; required by the app when reason = other.';
