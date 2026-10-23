-- Strategies pulled from an uploaded document while approved strategies are
-- published are saved here as the next draft version. Staff keep reading the
-- approved `content` until an admin approves the draft (which moves it into
-- `content`). Additive: main's code never reads or writes this column.
alter table public.client_specific_trainings
  add column if not exists draft_content jsonb;

comment on column public.client_specific_trainings.draft_content is
  'Next draft version (support strategies pulled from a document) awaiting approval; staff read the approved content until it is approved.';
