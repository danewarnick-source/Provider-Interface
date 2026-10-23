// Settings › New hires: sign a team member off to work alone at a home, or undo
// it with a reason (Decision 8). The signer is always the signed-in person;
// RLS lets the owner or that home's lead do it. Read side: new-hires.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGN_OFF_DENIED = "Only the owner or this home's lead can sign a new hire off.";

export const signOffNewHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; staffId: string; teamId: string }) =>
    z
      .object({
        organizationId: z.string().uuid(),
        staffId: z.string().uuid(),
        teamId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to sign off.");
    const { error } = await supabase.from("new_hire_signoffs").insert({
      organization_id: data.organizationId,
      staff_id: data.staffId,
      team_id: data.teamId,
      signed_by: userId,
    });
    if (error?.code === "23505") throw new Error("Already signed off at this home.");
    if (error) throw new Error(error.code === "42501" ? SIGN_OFF_DENIED : error.message);
    return { ok: true };
  });

export const endSignOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; signoffId: string; reason: string }) =>
    z
      .object({
        organizationId: z.string().uuid(),
        signoffId: z.string().uuid(),
        reason: z.string().trim().min(3, "Say why the sign-off is being removed.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to change a sign-off.");
    const { data: rows, error } = await supabase
      .from("new_hire_signoffs")
      .update({ ended_at: new Date().toISOString(), ended_by: userId, end_reason: data.reason })
      .eq("id", data.signoffId)
      .eq("organization_id", data.organizationId)
      .is("ended_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error(SIGN_OFF_DENIED);
    return { ok: true };
  });
