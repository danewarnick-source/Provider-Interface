// Call-outs from the shift page (dashboard.shift.$shiftId.tsx): a team member
// calls out of their own shift, and a scheduler locks coverage to close it.
// "Done" (acknowledge) is acknowledgeCallout in needs.functions.ts. Each step
// is logged in callout_escalation_events through addCalloutEvent
// (callout-events.server.ts), the one writer of call-out events. Runs as the caller (RLS: a person may call out
// of, and log events for, their own shift; schedulers for any).
// Finding cover is the escalation ladder (escalation.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { notify } from "@/lib/scheduler/notify";
import { shiftWhen } from "@/lib/scheduler/late-punch";
import { addCalloutEvent } from "@/lib/scheduler/callout-events.server";

const uuid = z.string().uuid();

/** How soon the shift starts: under 1 h critical, 4 h high, 12 h normal. Also shown on the shift page. */
export function calloutUrgency(
  startsAt: string,
  now = Date.now(),
): "low" | "normal" | "high" | "critical" {
  const hrs = (new Date(startsAt).getTime() - now) / 3_600_000;
  return hrs < 1 ? "critical" : hrs < 4 ? "high" : hrs < 12 ? "normal" : "low";
}

export const callOutOfShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; shift_id: string; reason: string }) =>
    z.object({ organization_id: uuid, shift_id: uuid, reason: z.string().max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to call out.");
    const { data: shift, error: sErr } = await supabase
      .from("scheduled_shifts")
      .select("id, staff_id, service_code, starts_at, ends_at")
      .eq("id", data.shift_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!shift || shift.staff_id !== userId)
      throw new Error("You can call out only of your own shift.");
    const urgency = calloutUrgency(shift.starts_at);
    const { data: co, error } = await supabase
      .from("shift_callouts")
      .insert({
        organization_id: data.organization_id,
        scheduled_shift_id: shift.id,
        staff_id: userId,
        reason: data.reason.trim() || null,
        urgency,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // A call-out notifies the scheduler; the event records what actually happened.
    const sent = await notify(supabase, {
      organization_id: data.organization_id,
      recipient_role: "admin",
      type: "callout",
      urgency: urgency === "low" ? "normal" : urgency,
      title: `Call-out: ${(shift.service_code ?? "shift").toUpperCase()} · ${shiftWhen(shift)}`,
      body: data.reason.trim() || "A team member can't make their shift.",
      link_to: "/dashboard/scheduler/needs?kind=callout",
      related_id: shift.id,
      related_type: "scheduled_shift",
    });
    await addCalloutEvent(supabase, data.organization_id, co.id, {
      channel: "in_app",
      target_role: "manager",
      outcome: sent ? "sent" : "failed",
      detail: sent
        ? "Scheduler notified in the app."
        : "Could not notify the scheduler. Tell them directly.",
    });
    if (!sent)
      throw new Error(
        "Your call-out was saved, but we could not notify the scheduler. Please tell them directly.",
      );
    return { id: co.id as string };
  });

/** Lock coverage & close: the scheduler has someone on it. */
export const lockCalloutCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; callout_id: string }) =>
    z.object({ organization_id: uuid, callout_id: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("shift_callouts")
      .update({ status: "coverage_locked", coverage_locked_at: now, resolved_at: now })
      .eq("id", data.callout_id)
      .eq("organization_id", data.organization_id)
      .eq("status", "manager_acknowledged")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("That call-out was already closed. Reload to see it.");
    await addCalloutEvent(supabase, data.organization_id, data.callout_id, {
      channel: "system",
      target_role: null,
      target_user_id: userId,
      outcome: "acknowledged",
      detail: "Coverage locked. Call-out closed.",
    });
    return { ok: true };
  });
