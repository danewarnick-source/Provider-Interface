// The scheduler's one background job (pg_cron every 5 minutes, see the draft
// job in supabase/migrations/20261118200000_scheduler_b_tick_job.sql): late
// clock-in alerts (lib/scheduler/late-alerts.server.ts), moving each
// escalation ladder forward, starting new ones inside the urgent window
// (lib/scheduler/escalation.server.ts), and keeping each rotation line's
// next 4 weeks drafted (lib/scheduler/rotation.server.ts; a line is rebuilt
// once it was last built 20 h ago). Auth: the shared NECTAR_CRON_SECRET
// (x-cron-secret header or Bearer); fails closed. Idempotent: alerts go once
// per shift, each ladder step once, and a rotation day is drafted once.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { runEscalations } from "@/lib/scheduler/escalation.server";
import { runLateAlerts } from "@/lib/scheduler/late-alerts.server";
import { runRotationBuilds } from "@/lib/scheduler/rotation.server";

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
        // Each part runs even if another fails.
        const [lateAlerts, escalations, rotations] = await Promise.all([
          settle(() => runLateAlerts(supabaseAdmin, now)),
          settle(() => runEscalations(supabaseAdmin, now)),
          settle(() => runRotationBuilds(supabaseAdmin, now)),
        ]);
        const ok = lateAlerts.ok && escalations.ok && rotations.ok;
        return json({ ok, lateAlerts, escalations, rotations }, ok ? 200 : 500);
      },
    },
  },
});
