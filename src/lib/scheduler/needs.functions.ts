// Needs you (B5) reads and its small actions. loadNeedsYou builds the list
// (needs.server.ts) for the page, the board banner and the Scheduler menu
// count. The actions run as the signed-in user after a scheduling check:
// Done on a call-out (acknowledge it, as the shift page did), Ask them to fix
// their punch (one notice per shift) and Send a reminder about a card (one a
// day per person). Approvals live in requests.functions.ts, punch fixes in
// punch-review.functions.ts, claims in open-shifts.functions.ts and "Didn't
// happen" is cancelShift (scheduler.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { punchFixAskText } from "@/lib/scheduler/late-punch";
import { loadNeeds } from "@/lib/scheduler/needs.server";
import { ASK_PUNCH, CARD_REMINDER, sentNotices } from "@/lib/scheduler/needs-notices.server";
import { notify } from "@/lib/scheduler/notify";
import { dayKey, parseLocalDate } from "@/lib/scheduler/time";

const uuid = z.string().uuid();

export const loadNeedsYou = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => z.object({ organization_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    const access = await requireCategory(supabase, userId, data.organization_id, "scheduling");
    return loadNeeds(supabase, data.organization_id, userId, access);
  });

/** Done on a call-out: the scheduler has seen it (manager_acknowledged). */
export const acknowledgeCallout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; callout_id: string }) =>
    z.object({ organization_id: uuid, callout_id: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { data: rows, error } = await supabase
      .from("shift_callouts")
      .update({
        status: "manager_acknowledged",
        manager_acknowledged_at: new Date().toISOString(),
        manager_acknowledged_by: userId,
      })
      .eq("id", data.callout_id)
      .eq("organization_id", data.organization_id)
      .eq("status", "open")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length)
      throw new Error("That call-out was already handled. Reload to see the list.");
    const { count } = await supabase
      .from("callout_escalation_events")
      .select("id", { count: "exact", head: true })
      .eq("callout_id", data.callout_id);
    const { error: evErr } = await supabase.from("callout_escalation_events").insert({
      organization_id: data.organization_id,
      callout_id: data.callout_id,
      step: (count ?? 0) + 1,
      channel: "in_app",
      target_role: "manager",
      target_user_id: userId,
      outcome: "acknowledged",
      detail: "Manager acknowledged call-out.",
    });
    if (evErr) console.error(`[callout] event insert failed: ${evErr.message}`);
    return { ok: true };
  });

/** Ask the person on a late or missed shift to add their time. Once per shift. */
export const askPunchFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; shift_id: string }) =>
    z.object({ organization_id: uuid, shift_id: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { askedAt: null as string | null };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { data: shift, error } = await supabase
      .from("scheduled_shifts")
      .select(
        "id, staff_id, client_id, service_code, starts_at, ends_at, status, published, parent_shift_id",
      )
      .eq("id", data.shift_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shift?.staff_id) throw new Error("That shift has no one on it to ask.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [already] = await sentNotices(supabaseAdmin, data.organization_id, ASK_PUNCH, [shift.id]);
    if (already) return { askedAt: already.created_at };
    const text = punchFixAskText(shift);
    const sent = await notify(supabase, {
      organization_id: data.organization_id,
      recipient_role: "staff",
      recipient_user_id: shift.staff_id,
      ...ASK_PUNCH,
      urgency: "normal",
      ...text,
      link_to: "/dashboard/my-time-corrections",
      related_id: shift.id,
    });
    if (!sent) throw new Error("The notice wasn't sent. Try again, or call them.");
    return { askedAt: new Date().toISOString() };
  });

/** Remind someone to upload a new card. Once a day per person. */
export const sendCardReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; staff_id: string; card: string }) =>
    z.object({ organization_id: uuid, staff_id: uuid, card: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = parseLocalDate(dayKey(new Date())).toISOString();
    const sent = await sentNotices(
      supabaseAdmin,
      data.organization_id,
      CARD_REMINDER,
      [data.staff_id],
      since,
    );
    if (sent.length) throw new Error("They were already reminded today.");
    const ok = await notify(supabase, {
      organization_id: data.organization_id,
      recipient_role: "staff",
      recipient_user_id: data.staff_id,
      ...CARD_REMINDER,
      urgency: "normal",
      title: "Upload your new card",
      body: `Your ${data.card} is expiring or has expired. Upload the new one in My Evidence so you can keep working your shifts.`,
      link_to: "/dashboard/my-evidence",
      related_id: data.staff_id,
    });
    if (!ok) throw new Error("The reminder wasn't sent. Try again.");
    return { ok: true };
  });
