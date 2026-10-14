// "Ask the PI team" from admin Nectar (moved here from nectar-help.functions.ts
// in N5; N6 keeps the action). It opens a support ticket for the PI team and
// shows its status. No model call, so no AI setting applies; the caller must
// be signed in and an active member of an agency with `nectar` on.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireNectarOrg } from "@/lib/nectar/engine/guard.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EscalateInput {
  question: string;
  context: string;
  organizationId: string;
}

function validateEscalate(input: unknown): EscalateInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const question = typeof i.question === "string" ? i.question.trim() : "";
  const context = typeof i.context === "string" ? i.context.trim() : "";
  const organizationId = typeof i.organizationId === "string" ? i.organizationId : "";
  if (question.length < 2 || question.length > 2000) {
    throw new Error("Question must be 2–2000 characters.");
  }
  if (!UUID_RE.test(organizationId)) throw new Error("Invalid organizationId.");
  return { question, context: context.slice(0, 8000), organizationId };
}

export const escalateHelpToHive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateEscalate)
  .handler(async ({ data, context }): Promise<{ ticketId: string; status: string }> => {
    const orgId = await requireNectarOrg(context, { orgId: data.organizationId, feature: null });
    const { supabase, userId } = context;

    const subject = data.question.length > 120 ? data.question.slice(0, 117) + "…" : data.question;

    const { data: inserted, error } = await supabase
      .from("org_support_tickets")
      .insert({
        organization_id: orgId,
        opened_by: userId,
        source: "nectar_help",
        subject,
        body: data.context
          ? `${data.question}\n\n— Recent NECTAR context —\n${data.context}`
          : data.question,
        status: "submitted",
        severity: "normal",
      })
      .select("id, status")
      .single();
    if (error) throw new Error("Could not reach the PI team. Please try again.");

    return { ticketId: inserted.id, status: inserted.status };
  });

interface TicketStatusInput {
  ticketId: string;
  organizationId: string;
}

function validateStatusInput(input: unknown): TicketStatusInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const ticketId = typeof i.ticketId === "string" ? i.ticketId : "";
  const organizationId = typeof i.organizationId === "string" ? i.organizationId : "";
  if (!UUID_RE.test(ticketId)) throw new Error("Invalid ticket id.");
  if (!UUID_RE.test(organizationId)) throw new Error("Invalid organizationId.");
  return { ticketId, organizationId };
}

export const getHelpTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateStatusInput)
  .handler(async ({ data, context }): Promise<{ status: string; updated_at: string } | null> => {
    const orgId = await requireNectarOrg(context, { orgId: data.organizationId, feature: null });
    const { data: t } = await context.supabase
      .from("org_support_tickets")
      .select("status, updated_at")
      .eq("id", data.ticketId)
      .eq("organization_id", orgId)
      .maybeSingle();
    return t ?? null;
  });
