// Time-off and swap decisions from Needs you (B5), on the server. Each checks
// scheduling edit, then the approver for the homes the request touches (B2
// Settings › Approvals, requests.server.ts), then writes through the caller's
// own login. Approving a swap puts the coworker on the shift through the rule
// engine and records the change, the same as an edit on the board. Staff are
// told the outcome; texts never name a client. Requests are created on the
// phone (requests.ts) and a coworker answers a swap in swap-response.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { shiftWhen } from "@/lib/scheduler/late-punch";
import { notify } from "@/lib/scheduler/notify";
import {
  loadSwapShift,
  reassignShift,
  requireApprover,
  shiftsOnDays,
} from "@/lib/scheduler/requests.server";

const uuid = z.string().uuid();
const Ref = z.object({ organization_id: uuid, request_id: uuid });

const range = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);

export const decideTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof Ref> & { approve: boolean }) =>
    Ref.extend({ approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const org = data.organization_id;
    const access = await requireCategory(supabase, userId, org, "scheduling", "edit");
    const { data: req, error } = await supabase
      .from("time_off_requests")
      .select("id, staff_id, start_date, end_date, type, status")
      .eq("id", data.request_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req || req.status !== "pending") throw new Error("That request was already decided.");
    const shifts = await shiftsOnDays(supabase, org, req.staff_id, req.start_date, req.end_date);
    await requireApprover(supabase, org, userId, access, "timeoff", shifts);
    const { data: rows, error: uErr } = await supabase
      .from("time_off_requests")
      .update({
        status: data.approve ? "approved" : "denied",
        decided_by: userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", req.id)
      .eq("organization_id", org)
      .eq("status", "pending")
      .select("id");
    if (uErr) throw new Error(uErr.message);
    if (!rows?.length) throw new Error("That request was already decided.");
    await notify(supabase, {
      organization_id: org,
      recipient_role: "staff",
      recipient_user_id: req.staff_id,
      type: "time_off_decided",
      urgency: "normal",
      title: data.approve ? "Time off approved" : "Time off not approved",
      body: `${range(req.start_date, req.end_date)} · ${req.type.toUpperCase()}`,
      link_to: "/dashboard/schedule",
      related_id: req.id,
      related_type: "time_off_request",
    });
    return { ok: true, shifts: data.approve ? shifts.length : 0 };
  });

async function loadSwap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  org: string,
  id: string,
) {
  const { data: req, error } = await supabase
    .from("shift_swap_requests")
    .select("id, shift_id, from_staff_id, to_staff_id, status, partner_status")
    .eq("id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!req || req.status !== "pending") throw new Error("That swap was already decided.");
  return req as {
    id: string;
    shift_id: string;
    from_staff_id: string;
    to_staff_id: string | null;
    partner_status: string;
  };
}

export const approveSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof Ref> & { override_reason?: string | null }) =>
    Ref.extend({ override_reason: z.string().max(1000).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false, warnings: [] as string[] };
    const org = data.organization_id;
    const access = await requireCategory(supabase, userId, org, "scheduling", "edit");
    const req = await loadSwap(supabase, org, data.request_id);
    if (req.partner_status !== "accepted" || !req.to_staff_id)
      throw new Error("The coworker hasn't accepted this swap yet.");
    const shift = await loadSwapShift(supabase, org, req.shift_id);
    await requireApprover(supabase, org, userId, access, "swap", [shift]);
    const warnings = await reassignShift(
      supabase,
      org,
      userId,
      shift,
      req.to_staff_id,
      data.override_reason?.trim() || null,
    );
    const { error } = await supabase
      .from("shift_swap_requests")
      .update({ status: "approved", decided_by: userId, decided_at: new Date().toISOString() })
      .eq("id", req.id)
      .eq("organization_id", org);
    if (error) throw new Error(error.message);
    const when = `${(shift.service_code ?? "").toUpperCase()} · ${shiftWhen(shift)}`;
    const base = {
      organization_id: org,
      recipient_role: "staff",
      urgency: "normal",
      link_to: "/dashboard/schedule",
      related_id: req.id,
      related_type: "shift_swap_request",
    };
    await notify(supabase, [
      {
        ...base,
        recipient_user_id: req.from_staff_id,
        type: "swap_approved",
        title: "Swap approved",
        body: `${when} is off your schedule.`,
      },
      {
        ...base,
        recipient_user_id: req.to_staff_id,
        type: "swap_assigned",
        title: "Swap approved: the shift is yours",
        body: `${when} is on your schedule.`,
      },
    ]);
    return { ok: true, warnings };
  });

export const denySwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof Ref>) => Ref.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const org = data.organization_id;
    const access = await requireCategory(supabase, userId, org, "scheduling", "edit");
    const req = await loadSwap(supabase, org, data.request_id);
    const shift = await loadSwapShift(supabase, org, req.shift_id);
    await requireApprover(supabase, org, userId, access, "swap", [shift]);
    const { error } = await supabase
      .from("shift_swap_requests")
      .update({ status: "denied", decided_by: userId, decided_at: new Date().toISOString() })
      .eq("id", req.id)
      .eq("organization_id", org);
    if (error) throw new Error(error.message);
    const body = `${(shift.service_code ?? "").toUpperCase()} · ${shiftWhen(shift)} stays as it was.`;
    await notify(
      supabase,
      [req.from_staff_id, req.to_staff_id]
        .filter((x): x is string => !!x)
        .map((id) => ({
          organization_id: org,
          recipient_role: "staff",
          recipient_user_id: id,
          type: "swap_request",
          urgency: "normal",
          title: "Swap not approved",
          body,
          link_to: "/dashboard/schedule",
          related_id: req.id,
          related_type: "shift_swap_request",
        })),
    );
    return { ok: true };
  });
