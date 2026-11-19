// The office side of the escalation ladder (ESCALATION-PLAN.md): Start
// escalation and Stop escalation on a Needs you row, and the shift drawer's
// "Who's been asked". Scheduling edit (start, stop) or view (the list),
// checked as the caller; the shift is read as the caller too (RLS scope).
// The ladder itself runs with the service role (escalation.server.ts).
// Staff answers are escalation-staff.functions.ts; the hold-over record is
// holdover.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { currentRun, encodeEvent, RUNG_LABEL, runEnd } from "@/lib/scheduler/escalation";
import { askedLines, type AskedLine } from "@/lib/scheduler/escalation-view";
import {
  ESC_SHIFT_COLUMNS,
  loadLadderEvents,
  type EscShift,
} from "@/lib/scheduler/escalation-load.server";
import { advanceEscalations } from "@/lib/scheduler/escalation.server";
import { staffNameMap } from "@/lib/scheduler/staff-lookup";
import { guardShiftRows } from "@/lib/scheduler/shift-guard.server";
import { recordShiftChange, SNAPSHOT_COLUMNS } from "@/lib/scheduler/shift-change.server";
import { snapshotOf } from "@/lib/scheduler/shift-change";

const Ref = z.object({ organization_id: z.string().uuid(), shift_id: z.string().uuid() });
type RefIn = z.input<typeof Ref>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function shiftAsCaller(supabase: any, orgId: string, id: string): Promise<EscShift> {
  const { data, error } = await supabase
    .from("scheduled_shifts")
    .select(ESC_SHIFT_COLUMNS)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That shift no longer exists or isn't one you schedule.");
  return data as EscShift;
}

/**
 * A call-out's shift still has the person who called out: it's made open
 * first (through the rule engine, recorded as a change), then escalated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openCalledOut(supabase: any, userId: string, s: EscShift): Promise<EscShift> {
  const { data: co } = await supabase
    .from("shift_callouts")
    .select("id")
    .eq("scheduled_shift_id", s.id)
    .eq("staff_id", s.staff_id)
    .in("status", ["open", "manager_acknowledged"])
    .limit(1)
    .maybeSingle();
  if (!co) throw new Error("This shift has someone on it. Nothing to escalate.");
  const next = { ...s, staff_id: null, status: "open" };
  await guardShiftRows(supabase, s.organization_id, [next]);
  const { data: rows, error } = await supabase
    .from("scheduled_shifts")
    .update({ staff_id: null, status: "open", open_spots: 1 })
    .eq("id", s.id)
    .eq("staff_id", s.staff_id)
    .select(SNAPSHOT_COLUMNS);
  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error("The shift changed. Reload and try again.");
  await recordShiftChange(supabase, s.organization_id, userId, s.id, snapshotOf(s), rows[0]);
  return next;
}

export const startEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RefIn) => Ref.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { message: "" };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    let s = await shiftAsCaller(supabase, data.organization_id, data.shift_id);
    if (s.status === "cancelled") throw new Error("This shift is cancelled.");
    if (new Date(s.ends_at).getTime() <= Date.now()) throw new Error("This shift is over.");
    if (s.staff_id) s = await openCalledOut(supabase, userId, s);
    if (!s.published) {
      // Like Offer: an open shift people are asked to take is published.
      const { error } = await supabase
        .from("scheduled_shifts")
        .update({ status: "open", published: true })
        .eq("id", s.id);
      if (error) throw new Error(error.message);
      s = { ...s, status: "open", published: true };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const run = currentRun((await loadLadderEvents(supabaseAdmin, [s.id])).get(s.id) ?? []);
    if (run && !runEnd(run)) throw new Error("Escalation is already running for this shift.");
    const step = (await advanceEscalations(supabaseAdmin, [s], { start: { by: userId } })).get(
      s.id,
    );
    if (step?.kind !== "ask") return { message: "No one to ask. Escalation finished." };
    const names = await staffNameMap(supabaseAdmin, step.targets);
    const who = step.targets.map((id) => names.get(id) ?? "Team member").join(", ");
    return {
      message:
        step.rung === "holdover"
          ? `Asked ${who} to stay`
          : `Asked ${who} (${RUNG_LABEL[step.rung]})`,
    };
  });

export const stopEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RefIn) => Ref.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const s = await shiftAsCaller(supabase, data.organization_id, data.shift_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const run = currentRun((await loadLadderEvents(supabaseAdmin, [s.id])).get(s.id) ?? []);
    if (!run || runEnd(run)) throw new Error("Escalation isn't running for this shift.");
    const { error } = await supabaseAdmin.from("callout_escalation_events").insert({
      ...encodeEvent({ kind: "stopped", by: userId, detail: "Stopped by hand." }),
      organization_id: s.organization_id,
      scheduled_shift_id: s.id,
    });
    if (error) throw new Error(`It wasn't stopped (${error.message}). Try again.`);
    return { ok: true };
  });

/** The drawer's "Who's been asked": every ladder step for the shift, with its answer. */
export const listEscalationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RefIn) => Ref.parse(d))
  .handler(async ({ data, context }): Promise<AskedLine[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "view");
    const s = await shiftAsCaller(supabase, data.organization_id, data.shift_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const events = (await loadLadderEvents(supabaseAdmin, [s.id])).get(s.id) ?? [];
    if (!events.length) return [];
    const ids = events.flatMap((e) =>
      "userId" in e ? [e.userId] : "by" in e && e.by ? [e.by] : [],
    );
    const names = await staffNameMap(supabaseAdmin, ids);
    return askedLines(events, (id) => (id && names.get(id)) || "Team member");
  });
