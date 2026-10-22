-- PHASE B — apply only AFTER the "Remove Smart Import" change (Clients polish
-- C7) has merged to main. Until then production main still runs Smart Import
-- against this shared database: its "Finish setup" draft rows and the daily
-- smart-import-reminders hook would break if applied earlier.
--
-- Additive only: no table, column or row is dropped. The import tables and
-- their rows stay for the later removal step.

-- 1. Discard every open Smart Import client draft so nothing references it.
update public.import_subjects
   set discarded_at = now()
 where subject_type = 'client'
   and committed_at is null
   and discarded_at is null;

-- 2. Stop the daily pg_cron job that called /api/public/hooks/smart-import-reminders
--    (the route is removed with C7).
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'smart-import-reminders';
