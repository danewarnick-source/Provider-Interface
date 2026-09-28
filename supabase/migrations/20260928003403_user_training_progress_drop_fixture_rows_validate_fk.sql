-- user_training_progress: remove three synthetic test fixtures, then validate
-- the foreign key.
--
-- 20260928002213_team_members_restrict_record_cascades.sql had to add
-- user_training_progress_user_id_fkey as NOT VALID because 13 rows referenced
-- user_ids that do not exist in auth.users:
--   11111111-1111-1111-1111-111111111111  (6 rows)
--   22222222-2222-2222-2222-222222222222  (5 rows)
--   33333333-3333-3333-3333-333333333333  (2 rows)
-- These are test fixtures, not real records: placeholder ids that were never
-- an auth.users account, a profile, or an organization member, all seeded in
-- one batch (created_at 2026-05-24 05:00:51 UTC). Confirmed read-only before
-- this migration was written: exactly 13 orphan rows in the table, all 13
-- under these three ids, none of the three ids present in auth.users.
-- Deleting them is a one-time, explicitly approved exception to "never
-- delete records" — nothing a person did is being removed.
--
-- Guarded twice: a row goes only if its user_id is one of the three ids above
-- AND that id is still absent from auth.users, so a real account that ever
-- reused one of these ids would be left alone. VALIDATE CONSTRAINT then
-- fails the whole migration if any other orphan remains, so the FK can never
-- be marked valid over bad data.

DELETE FROM public.user_training_progress AS t
WHERE t.user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id);

ALTER TABLE public.user_training_progress
  VALIDATE CONSTRAINT user_training_progress_user_id_fkey;
