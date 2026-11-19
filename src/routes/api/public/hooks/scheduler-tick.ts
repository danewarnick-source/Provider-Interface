// The scheduler's one background job (pg_cron every 5 minutes, see the draft
// job in supabase/migrations/20261118200000_scheduler_b_tick_job.sql): late
// clock-in alerts (lib/scheduler/late-alerts.server.ts) and moving each
// escalation ladder forward, starting new ones inside the urgent window
// (lib/scheduler/escalation.server.ts). Auth: the shared NECTAR_CRON_SECRET
// (x-cron-secret header or Bearer); fails closed. Idempotent: alerts go once
// per shift and each ladder step once.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { runEscalations } from "@/lib/scheduler/escalation.server";
import { runLateAlerts } from "@/lib/scheduler/late-alerts.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const settle = async <T>(run: () => Promise<T>) => {
  try {
    return { ok: true as const, ...(await run()) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "failed" };
  }
};

export const Route = createFileRoute("/api/public/hooks/scheduler-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return json({ ok: false, error: "Unauthorized" }, 401);
        const now = new Date();
        // Each half runs even if the other fails.
        const [lateAlerts, escalations] = await Promise.all([
          settle(() => runLateAlerts(supabaseAdmin, now)),
          settle(() => runEscalations(supabaseAdmin, now)),
        ]);
        const ok = lateAlerts.ok && escalations.ok;
        return json({ ok, lateAlerts, escalations }, ok ? 200 : 500);
      },
    },
  },
});
