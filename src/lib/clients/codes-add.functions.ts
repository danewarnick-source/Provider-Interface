// Add one or more service codes to a client (the "Add a new authorized
// code" control). Upserts client_billing_codes — the one source for a
// client's codes — with the unit type (and a suggested standard rate, where
// the state template publishes one) and 0 annual units until the 1056 is in.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertCanManageClient } from "./guards.server";

export const addClientBillingCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        codes: z.array(z.string().min(1).max(8)).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) return { ok: false, added: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { isDailyServiceCode } = await import("@/lib/service-billing");

    const { data: client } = await sb
      .from("clients")
      .select("id, organization_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");
    await assertCanManageClient({
      supabase: sb,
      actorId: context.userId,
      organizationId: client.organization_id,
      clientId: data.clientId,
      action: "edit_billing",
    });

    const codes = Array.from(
      new Set(data.codes.map((c) => c.trim().toUpperCase()).filter(Boolean)),
    );
    if (codes.length === 0) return { ok: true, added: 0 };

    // Auto-fill unit type (and, where published, a suggested standard rate)
    // from the org's published state template so a newly added code doesn't
    // land with a blank/guessed unit type. Falls back to the daily/quarter-
    // hour heuristic when the template has no entry for a code.
    const { data: org } = await sb
      .from("organizations")
      .select("state_code")
      .eq("id", client.organization_id)
      .maybeSingle();
    const stateCode = (org as { state_code?: string | null } | null)?.state_code ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateCodeByCode = new Map<string, any>();
    if (stateCode) {
      const { data: tpl } = await sb
        .from("state_templates")
        .select("billing_codes")
        .eq("state_code", stateCode)
        .not("published_at", "is", null)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tplCodes = (tpl as any)?.billing_codes?.codes ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of tplCodes as any[]) {
        if (c?.code) templateCodeByCode.set(String(c.code).toUpperCase(), c);
      }
    }

    const STATE_UNIT_TYPE_TO_STORED: Record<string, string> = {
      "15min": "Q",
      hourly: "hourly",
      daily: "day",
    };

    const rows = codes.map((code) => {
      const tplCode = templateCodeByCode.get(code);
      const unit_type =
        (tplCode?.unit_type && STATE_UNIT_TYPE_TO_STORED[tplCode.unit_type]) ||
        (isDailyServiceCode(code) ? "day" : "Q");
      const rate_per_unit =
        typeof tplCode?.rate === "number" && tplCode.rate > 0 ? tplCode.rate : 0;
      return {
        organization_id: client.organization_id,
        client_id: data.clientId,
        service_code: code,
        unit_type,
        annual_unit_authorization: 0,
        rate_per_unit,
      };
    });
    const { data: upserted, error: uErr } = await sb
      .from("client_billing_codes")
      .upsert(rows, { onConflict: "organization_id,client_id,service_code" })
      .select("id");
    if (uErr) throw new Error(uErr.message);
    if (!upserted || upserted.length === 0) {
      throw new Error("No billing-code rows were written.");
    }

    return { ok: true, added: upserted.length };
  });
