// Publish / Send changes for one week of the scheduler board (B4).
// previewPublish: the checklist (publish-plan.server.ts): blocks, shifts that
// need a reason, reminders, over the overtime threshold, who gets a notice,
// open shifts to offer. sendChanges: refuses while any block or missing reason
// remains (sendBlocker); otherwise publishes the drafts (typed reasons saved
// in override_reason), marks the week's changes sent, sends one notice to each
// affected person (no client details; shift-change.ts noticeFor) and offers
// the open shifts (offer.server.ts). Both need scheduling edit and run as the
// caller (RLS applies).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { loadPublishPlan } from "@/lib/scheduler/publish-plan.server";
import { sendBlocker } from "@/lib/scheduler/publish-plan";
import { noticeFor } from "@/lib/scheduler/shift-change";
import { offerShifts } from "@/lib/scheduler/offer.server";
import { notify } from "@/lib/scheduler/notify";
import { parseLocalDate } from "@/lib/scheduler/time";

const uuid = z.string().uuid();
const Week = z.object({
  organization_id: uuid,
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const SendInput = Week.extend({ reasons: z.record(uuid, z.string().max(1000)).default({}) });

export const previewPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof Week>) => Week.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to publish.");
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    return (await loadPublishPlan(supabase, data.organization_id, data.week_start)).plan;
  });

export const sendChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof SendInput>) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to publish.");
    const org = data.organization_id;
    await requireCategory(supabase, userId, org, "scheduling", "edit");
    const { plan, byId } = await loadPublishPlan(supabase, org, data.week_start);
    const reasons = Object.fromEntries(
      Object.entries(data.reasons)
        .map(([id, r]) => [id, r.trim()] as const)
        .filter(([id, r]) => r && plan.checked.includes(id)),
    );
    const blocker = sendBlocker(plan, reasons);
    if (blocker) throw new Error(`Nothing was sent. ${blocker}`);

    const drafts = new Set(plan.drafts);
    for (const [id, reason] of Object.entries(reasons)) {
      const publish = drafts.has(id) ? { published: true, status: "published" } : {};
      const { error } = await supabase
        .from("scheduled_shifts")
        .update({ override_reason: reason, ...publish })
        .eq("id", id)
        .eq("organization_id", org);
      if (error) throw error;
      drafts.delete(id);
    }
    if (drafts.size) {
      const { error } = await supabase
        .from("scheduled_shifts")
        .update({ published: true, status: "published" })
        .in("id", [...drafts])
        .eq("organization_id", org);
      if (error) throw error;
    }
    if (plan.changeIds.length) {
      const { error } = await supabase
        .from("shift_changes")
        .update({ sent_at: new Date().toISOString() })
        .in("id", plan.changeIds)
        .eq("organization_id", org);
      if (error) throw error;
    }

    const weekLabel = parseLocalDate(data.week_start).toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      month: "short",
      day: "numeric",
    });
    await notify(
      supabase,
      plan.notify.map((staffId) => {
        const mine = plan.changes.filter((c) => c.affected.includes(staffId));
        const fresh = plan.drafts.filter((id) => byId.get(id)?.staff_id === staffId).length;
        return {
          organization_id: org,
          recipient_role: "staff",
          recipient_user_id: staffId,
          urgency: "normal",
          link_to: "/dashboard/schedule",
          ...noticeFor(staffId, mine, fresh, weekLabel),
        };
      }),
    );
    const offered = await offerShifts(
      supabase,
      org,
      plan.openToOffer.map((id) => byId.get(id)!),
    );
    return {
      published: plan.drafts.length,
      changes: plan.changes.length,
      people: plan.notify.length,
      offered,
    };
  });
