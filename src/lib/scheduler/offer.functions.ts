// Offering open shifts from the scheduler board, and who's been asked.
// offerOpenShifts runs offer.server.ts (open + published, everyone qualified
// notified at once, Decision 6); listShiftOffers reads those notifications
// back as the shift drawer's "Who's been asked". Claims then run through
// open-shifts.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { SHIFT_COLUMNS } from "@/lib/scheduler/shift-guard.server";
import { OFFER_TYPE, offerShifts, type OfferShift } from "@/lib/scheduler/offer.server";

const uuid = z.string().uuid();

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
    const shifts = ((found ?? []) as OfferShift[]).filter(
      (s) => !s.staff_id && s.status !== "cancelled",
    );
    if (!shifts.length)
      throw new Error("Those shifts already have someone on them or were cancelled.");
    return offerShifts(supabase, data.organization_id, shifts);
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
