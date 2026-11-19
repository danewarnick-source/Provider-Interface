// The one punch-fix decision (a staff member's time correction on
// evv_timesheets, review_status 'needs_review'), used by Needs you and by
// Documentation › Records (time-correction-review-section.tsx). Approve makes
// the corrected times the ones that bill (effectiveBillingTimes); "Ask for
// more detail" returns it with a note the staff member sees and can resubmit.
// Needs Timesheets edit; writes through the caller's own login (RLS applies).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";

const Input = z
  .object({
    organization_id: z.string().uuid(),
    timesheet_id: z.string().uuid(),
    approve: z.boolean(),
    note: z.string().max(1000).optional(),
  })
  .refine((d) => d.approve || !!d.note?.trim(), {
    message: "Say what detail you need, so they can resubmit.",
  });

export const reviewPunchFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof Input>) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "timesheets", "edit");
    const { data: rows, error } = await supabase
      .from("evv_timesheets")
      .update({
        review_status: data.approve ? "approved" : "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ...(data.approve ? {} : { review_note: data.note!.trim() }),
      })
      .eq("id", data.timesheet_id)
      .eq("organization_id", data.organization_id)
      .eq("review_status", "needs_review")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length)
      throw new Error(
        "That correction was already decided, or you can't edit it. Reload the list.",
      );
    return { ok: true };
  });
