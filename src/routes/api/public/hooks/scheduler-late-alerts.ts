// pg_cron hook (every 5 minutes, see the draft job in
// supabase/migrations/20261118200000_scheduler_b_late_alerts_job.sql): late
// clock-in nudges to staff at +10 minutes and alerts to the lead or schedulers
// at +30 (lib/scheduler/late-alerts.server.ts). Auth: the shared
// NECTAR_CRON_SECRET (x-cron-secret header or Bearer). Idempotent: each alert
// is sent once per shift.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { runLateAlerts } from "@/lib/scheduler/late-alerts.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/hooks/scheduler-late-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return json({ ok: false, error: "Unauthorized" }, 401);
        try {
          return json({ ok: true, ...(await runLateAlerts(supabaseAdmin)) });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "failed" }, 500);
        }
      },
    },
  },
});
