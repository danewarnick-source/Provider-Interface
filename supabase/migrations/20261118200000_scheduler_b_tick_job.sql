-- APPLY ONLY AFTER B5 IS ON MAIN AND THE PRODUCTION SITE HAS NECTAR_CRON_SECRET — ask Dane
--
-- Scheduler tick (B5 + escalation ladder): every 5 minutes, ask the PRODUCTION
-- site to send late clock-in alerts (staff nudge at +10 minutes, lead or
-- scheduler alert at +30) and to move each escalation ladder forward (lead →
-- on-call → owner → hold-over), starting one for an open shift inside the
-- urgent window. The hook is src/routes/api/public/hooks/scheduler-tick.ts; it
-- is idempotent (each alert goes once per shift, recorded as the notification
-- row; each ladder step once, recorded in callout_escalation_events).
-- Shape copied from the gmail-ingest-5min job
-- (20260612193633_aaf83b2d-5a61-49f2-97ab-cce7752d1fbf.sql): pg_net POST with
-- the shared secret read from vault.decrypted_secrets. That vault read is the
-- file's shape, not checked against the live jobs; confirm the live
-- gmail-ingest-5min command uses the same secret name before applying.
-- The four existing jobs (on the old staging host) are not touched.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduler-tick') THEN
    PERFORM cron.unschedule('scheduler-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'scheduler-tick',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://providerinterface.com/api/public/hooks/scheduler-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'NECTAR_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
