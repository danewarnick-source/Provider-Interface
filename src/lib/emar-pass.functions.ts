import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { correctionAccess } from "@/lib/medications/mar-review";
import { assertCanManageClient } from "@/lib/clients/guards.server";

// Doses are logged by logMedicationPass in src/lib/medications/give-meds.functions.ts.

const AddendumInput = z.object({
  logId: z.string().uuid(),
  note: z.string().trim().min(3).max(2000),
  reason: z.string().trim().min(3).max(500),
});

// A correction to a logged dose. The original stays as it was; corrections
// are insert-only. Allowed for someone with client_medical:edit, or for the
// person who logged the dose within 24 hours of logging it. The insert runs
// as the caller, so the database rule checks the same thing.
export const addEmarAddendum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddendumInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log, error } = await supabaseAdmin
      .from("emar_logs")
      .select("id, organization_id, client_id, staff_id, created_at")
      .eq("id", data.logId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Dose not found.");
    let canEditMedical = true;
    try {
      await assertCanManageClient({
        supabase,
        actorId: userId,
        organizationId: log.organization_id,
        clientId: log.client_id,
        action: "edit_medical",
      });
    } catch (e) {
      canEditMedical = false;
      if (!correctionAccess({ log, userId, canEditMedical })) throw e;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = (profile as { full_name?: string } | null)?.full_name || "Staff";
    const { error: insErr } = await supabase.from("emar_log_addenda").insert({
      emar_log_id: data.logId,
      organization_id: log.organization_id,
      note: data.note,
      reason: data.reason,
      staff_id: userId,
      staff_name: fullName,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });
