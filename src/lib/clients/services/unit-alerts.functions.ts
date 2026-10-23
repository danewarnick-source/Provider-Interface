// "Coordinator emailed" records on Services & billing authorization cards
// (client_unit_alerts; the rule is unit-alerts.ts). PI sends nothing: the
// user emails from their own app, then ticks "I sent it". Recording and Undo
// are for Owners and Admins with Billing: Edit (canRecordUnitAlert; the RLS
// policies match), and recording needs the warning to show. Undo is a soft
// void. Names come from profiles, joined in JS.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { denverYmdFromInstant } from "@/lib/denver-date";
import { assertCanManageClient } from "../guards.server";
import { loadClientServices } from "./services-load";
import { UNIT_ALERT_NOT_ALLOWED, canRecordUnitAlert, type UnitAlert } from "./unit-alerts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

const profileName = (p: ProfileRow) =>
  p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim();

/** Owners and Admins with Billing: Edit who can work on this client. */
async function assertCanRecord(sb: Sb, userId: string, organizationId: string, clientId: string) {
  await assertCanManageClient({
    supabase: sb,
    actorId: userId,
    organizationId,
    clientId,
    action: "edit_billing",
  });
  const access = await requireCategory(sb, userId, organizationId, "billing", "edit");
  if (!canRecordUnitAlert(access.level, true)) throw new Error(UNIT_ALERT_NOT_ALLOWED);
}

/** Live records for the client's authorization rows, with who recorded each. */
export const getUnitAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(scope).parse(d))
  .handler(async ({ data, context }): Promise<UnitAlert[]> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, ...data, action: "view" });
    await requireCategory(sb, userId, data.organizationId, "billing", "view");
    const { data: rows, error } = await sb
      .from("client_unit_alerts")
      .select("id, billing_code_id, recorded_by, recorded_at")
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("voided_at", null);
    if (error) throw new Error(error.message);
    const live = (rows ?? []) as Array<{
      id: string;
      billing_code_id: string;
      recorded_by: string;
      recorded_at: string;
    }>;
    const ids = [...new Set(live.map((r) => r.recorded_by))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, first_name, last_name, full_name")
        .in("id", ids);
      for (const p of (profs ?? []) as ProfileRow[])
        if (profileName(p)) names.set(p.id, profileName(p));
    }
    return live.map((r) => ({
      id: r.id,
      billingCodeId: r.billing_code_id,
      by: names.get(r.recorded_by) ?? null,
      on: denverYmdFromInstant(r.recorded_at) ?? r.recorded_at.slice(0, 10),
    }));
  });

/** "I sent it": records who and when, with the units and run-out date shown at the time. */
export const recordUnitAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, billingCodeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanRecord(sb, userId, organizationId, clientId);
    const services = await loadClientServices(sb, organizationId, clientId);
    const view = services.authorizations.find((v) => v.row.id === data.billingCodeId);
    if (!view) throw new Error("That authorization wasn't found for this client.");
    if (view.state !== "current" || !view.runsOutOn) {
      throw new Error("These units aren't running out early any more.");
    }
    const { error } = await sb.from("client_unit_alerts").insert({
      organization_id: organizationId,
      client_id: clientId,
      billing_code_id: view.row.id,
      service_code: view.row.service_code,
      units_used: view.pace.used,
      units_total: view.pace.annual,
      runout_on: view.runsOutOn,
      recorded_by: userId,
    });
    if (error) {
      throw new Error(
        /duplicate|unique/i.test(error.message)
          ? "This is already marked as emailed."
          : error.message,
      );
    }
    return { ok: true };
  });

/** Undo: a soft void; the button comes back. */
export const voidUnitAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, alertId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanRecord(sb, userId, organizationId, clientId);
    const { data: voided, error } = await sb
      .from("client_unit_alerts")
      .update({ voided_at: new Date().toISOString(), voided_by: userId })
      .eq("id", data.alertId)
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .is("voided_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!voided?.length) throw new Error("Couldn't undo. Refresh and try again.");
    return { ok: true };
  });
