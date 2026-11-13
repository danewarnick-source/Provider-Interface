// Offering open shifts from the scheduler board, and who's been asked.
// offerOpenShifts makes each shift open and visible to staff (published, no
// one on it) and notifies everyone qualified for it at once (Decision 6):
// qualified = Find staff's "Good fit" or "Check" rows (rank-staff.ts), so
// people who need a reason, are missing an Evidence item or can't take it are
// never offered it. The notification rows are the record of who was asked;
// listShiftOffers reads them back for the shift drawer. Claims then run
// through open-shifts.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { SHIFT_COLUMNS, type ShiftRowIn } from "@/lib/scheduler/shift-guard.server";
import { rankCandidates } from "@/lib/scheduler/find-staff.server";
import { isQualified } from "@/lib/scheduler/rank-staff";
import { fmtSpan } from "@/lib/scheduler/board-model";
import { notify, type SchedulerNotification } from "@/lib/scheduler/notify";
import { dayKey, parseLocalDate } from "@/lib/scheduler/time";

const uuid = z.string().uuid();
const OFFER_TYPE = "shift_published";

function when(s: ShiftRowIn): string {
  const day = parseLocalDate(dayKey(s.starts_at)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} ${fmtSpan(s)}`;
}

export const offerOpenShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; shift_ids: string[] }) =>
    z.object({ organization_id: uuid, shift_ids: z.array(uuid).min(1).max(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { people: 0, shifts: 0 };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { data: found, error } = await supabase
      .from("scheduled_shifts")
      .select(`${SHIFT_COLUMNS}, open_spots`)
      .eq("organization_id", data.organization_id)
      .in("id", data.shift_ids);
    if (error) throw error;
    const shifts = (
      (found ?? []) as Array<ShiftRowIn & { id: string; open_spots: number | null }>
    ).filter((s) => !s.staff_id && s.status !== "cancelled");
    if (!shifts.length)
      throw new Error("Those shifts already have someone on them or were cancelled.");

    const people = new Set<string>();
    const notes: SchedulerNotification[] = [];
    for (const s of shifts) {
      const { data: rows, error: uErr } = await supabase
        .from("scheduled_shifts")
        .update({ status: "open", published: true, open_spots: s.open_spots ?? 1 })
        .eq("id", s.id)
        .is("staff_id", null)
        .select("id");
      if (uErr) throw uErr;
      if (!rows?.length) continue;
      const qualified = (await rankCandidates(supabase, data.organization_id, s)).filter(
        isQualified,
      );
      for (const c of qualified) {
        people.add(c.staffId);
        notes.push({
          organization_id: data.organization_id,
          recipient_role: "staff",
          recipient_user_id: c.staffId,
          type: OFFER_TYPE,
          urgency: "normal",
          title: "Open shift you can pick up",
          body: `${(s.service_code ?? "").toUpperCase()} · ${when(s)}`,
          link_to: "/dashboard/schedule",
          related_id: s.id,
          related_type: "scheduled_shift",
        });
      }
    }
    await notify(supabase, notes);
    return { people: people.size, shifts: shifts.length };
  });

/** Who an open shift was offered to, and whether they've seen it. */
export const listShiftOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; shift_id: string }) =>
    z.object({ organization_id: uuid, shift_id: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "view");
    // Staff notifications are readable only by their recipient; the check above gates this read.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("notifications")
      .select("recipient_user_id, created_at, read_at")
      .eq("organization_id", data.organization_id)
      .eq("related_id", data.shift_id)
      .eq("related_type", "scheduled_shift")
      .eq("type", OFFER_TYPE)
      .not("recipient_user_id", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []).map((r) => ({
      staffId: r.recipient_user_id as string,
      askedAt: r.created_at,
      seenAt: r.read_at,
    }));
  });
