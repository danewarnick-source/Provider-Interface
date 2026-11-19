-- Scheduler tick (B5 + escalation ladder): every 5 minutes, ask the PRODUCTION site to send
-- late clock-in alerts and move escalation ladders forward. Turned on Nov 19 with Dane's OK,
-- after an in-database test call returned 200. The four existing jobs are not touched.
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
