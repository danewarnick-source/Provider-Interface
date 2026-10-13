import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notify } from "@/lib/scheduler/notify";

/**
 * The named coworker (or, for an open swap, any coworker) accepts or declines.
 * The scheduler still approves. Goes through the respond_to_swap_request
 * database function so the coworker can only touch the partner fields.
 */
export const respondToSwapRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string; accept: boolean }) =>
    z.object({ requestId: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    const { data: rows, error } = await supabase.rpc("respond_to_swap_request", {
      _request: data.requestId,
      _accept: data.accept,
    });
    if (error) throw new Error(error.message);
    const r = rows?.[0];
    if (!r) throw new Error("Swap request not found");
    const accepted = r.partner_status === "accepted";
    const declined = r.partner_status === "declined";
    if (accepted || declined) {
      await notify(supabase, [
        {
          organization_id: r.organization_id,
          recipient_role: "admin",
          type: "swap_partner_accepted",
          title: accepted ? "Swap awaiting approval" : "Swap declined by coworker",
          body: accepted
            ? "A coworker accepted a swap request. Review and approve it."
            : "A coworker declined a swap request.",
          link_to: "/dashboard/scheduler",
          related_id: r.id,
          related_type: "shift_swap_request",
        },
        {
          organization_id: r.organization_id,
          recipient_role: "staff",
          recipient_user_id: r.from_staff_id,
          type: "swap_partner_accepted",
          title: accepted ? "Your swap was accepted" : "Your swap was declined",
          body: accepted
            ? "A coworker accepted. The scheduler still needs to approve it."
            : "A coworker declined your swap request.",
          link_to: "/dashboard/schedule",
          related_id: r.id,
          related_type: "shift_swap_request",
        },
      ]);
    }
    return { ok: true as const, partner_status: r.partner_status as string };
  });
