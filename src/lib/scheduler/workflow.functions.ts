import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notify } from "@/lib/scheduler/notify";

// Staff response to a published shift. Writes status and, on decline, files an
// admin notification + appends the reason to the shift notes field.
export const respondToShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    shiftId: string;
    response: "accepted" | "declined";
    declineReason?: string;
  }) => z.object({
    shiftId: z.string().uuid(),
    response: z.enum(["accepted", "declined"]),
    declineReason: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const { data: shift, error: rErr } = await supabase
      .from("scheduled_shifts")
      .select("id, organization_id, staff_id, client_id, starts_at, ends_at, service_code, notes")
      .eq("id", data.shiftId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!shift) throw new Error("Shift not found");
    if (shift.staff_id !== userId) throw new Error("Not your shift");

    const patch: Record<string, unknown> = { status: data.response };
    if (data.response === "declined" && data.declineReason) {
      const prefix = shift.notes ? shift.notes + "\n" : "";
      patch.notes = `${prefix}Declined: ${data.declineReason}`;
    }
    const { error: uErr } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("scheduled_shifts").update(patch as any).eq("id", data.shiftId);
    if (uErr) throw uErr;

    if (data.response === "declined") {
      const startLabel = new Date(shift.starts_at).toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      await notify(supabase, {
        organization_id: shift.organization_id,
        recipient_role: "admin",
        type: "shift_declined",
        urgency: "urgent",
        title: `Shift declined — ${shift.service_code ?? "shift"} · ${startLabel}`,
        body: data.declineReason || "Staff declined the published shift.",
        link_to: "/dashboard/scheduler",
        related_id: shift.id,
        related_type: "shift_decline",
      });
    }
    return { ok: true };
  });

// Pulls the "Action needed" feed for admins: declined published shifts +
// pending swap requests, scoped to the org and a date range.
export const getActionNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; startIso: string; endIso: string }) =>
    z.object({
      organizationId: z.string().uuid(),
      startIso: z.string(),
      endIso: z.string(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!supabase) return { declines: [], swaps: [], openShifts: [] };
    const [declines, swaps, openShifts] = await Promise.all([
      supabase.from("scheduled_shifts")
        .select("id, staff_id, client_id, starts_at, ends_at, service_code, notes")
        .eq("organization_id", data.organizationId)
        .eq("status", "declined")
        .gte("starts_at", data.startIso)
        .lt("starts_at", data.endIso)
        .order("starts_at"),
      supabase.from("shift_swap_requests")
        .select("id, shift_id, from_staff_id, to_staff_id, note, created_at")
        .eq("organization_id", data.organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("scheduled_shifts")
        .select("id, client_id, starts_at, ends_at, service_code")
        .eq("organization_id", data.organizationId)
        .eq("status", "open")
        .gte("starts_at", data.startIso)
        .lt("starts_at", data.endIso)
        .order("starts_at"),
    ]);
    return {
      declines: declines.data ?? [],
      swaps: swaps.data ?? [],
      openShifts: openShifts.data ?? [],
    };
  });
