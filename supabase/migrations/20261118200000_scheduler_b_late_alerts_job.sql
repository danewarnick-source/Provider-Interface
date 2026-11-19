-- APPLY ONLY AFTER B5 IS ON MAIN AND THE PRODUCTION SITE HAS NECTAR_CRON_SECRET — ask Dane
--
-- Scheduler B5: every 5 minutes, ask the PRODUCTION site to send late clock-in
-- alerts (staff nudge at +10 minutes, lead or scheduler alert at +30). The hook
-- is src/routes/api/public/hooks/scheduler-late-alerts.ts; it is idempotent
-- (each alert goes once per shift, recorded as the notification row).
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
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduler-late-alerts-5min') THEN
    PERFORM cron.unschedule('scheduler-late-alerts-5min');
  END IF;
END $$;

SELECT cron.schedule(
  'scheduler-late-alerts-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://providerinterface.com/api/public/hooks/scheduler-late-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'NECTAR_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
