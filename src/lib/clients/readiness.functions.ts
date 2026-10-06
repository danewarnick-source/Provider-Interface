// Client readiness — proves end-to-end wiring with real queries before
// claiming "live". Used by the client profile and the Smart Import done
// page; never relies on UI flags.
import { isActiveCodeRow } from "./codes";
import { guardianSatisfied, loadClientContacts } from "./contacts";
import { todayYmd } from "./dates";
import { goalsOn } from "./plans";
import { loadPlanBundle } from "./plans-load";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isClockableServiceCode } from "@/lib/service-billing";
import { isAdminLevel } from "@/lib/access/levels";

export type ReadinessReport = {
  schedulable: boolean;
  hasStaff: boolean;
  evvReady: boolean;
  billable: boolean;
  guardianValid: boolean;
  goalsPresent: boolean;
  isLive: boolean; // schedulable && hasStaff && evvReady
  // Context for the inline "Add codes" question — so NECTAR can state
  // what the client already has and ask the specific missing piece.
  currentCodes: string[];
  clockableCodes: string[];
};

export const clientReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReadinessReport> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const userId = context.userId as string;
    if (!sb || !userId) {
      return {
        schedulable: false,
        hasStaff: false,
        evvReady: false,
        billable: false,
        guardianValid: false,
        goalsPresent: false,
        isLive: false,
        currentCodes: [],
        clockableCodes: [],
      };
    }

    const { data: client } = await sb
      .from("clients")
      .select("organization_id, home_latitude, home_longitude, is_own_guardian")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) throw new Error("Client not found");

    // Admin guard — must be an active admin/manager for this org.
    const { data: membership } = await sb
      .from("organization_members")
      .select("access_level")
      .eq("organization_id", client.organization_id)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");
    const level = (membership as { access_level: string | null }).access_level;
    if (!isAdminLevel(level)) {
      throw new Error("Forbidden");
    }

    const [{ data: codes }, { count: staffCount }, contacts, plans] = await Promise.all([
      sb
        .from("client_billing_codes")
        .select("service_code, rate_per_unit, annual_unit_authorization, service_end_date")
        .eq("organization_id", client.organization_id)
        .eq("client_id", data.clientId),
      sb
        .from("staff_assignments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", client.organization_id)
        .eq("client_id", data.clientId),
      loadClientContacts(sb, [data.clientId]),
      loadPlanBundle(sb, data.clientId),
    ]);

    const today = todayYmd();
    const codeRows = ((codes ?? []) as Array<{
      service_code: string | null;
      rate_per_unit: number | null;
      annual_unit_authorization: number | null;
      service_end_date: string | null;
    }>).filter((c) => isActiveCodeRow(c, today));

    // Codes on file: active client_billing_codes rows are the one source.
    const codeSet = new Set<string>();
    for (const c of codeRows) {
      if (c.service_code?.trim()) codeSet.add(c.service_code.trim().toUpperCase());
    }
    const currentCodes = Array.from(codeSet).sort();
    const clockableCodes = currentCodes.filter((c) => isClockableServiceCode(c));

    const schedulable = clockableCodes.length > 0;
    const billable = codeRows.some(
      (c) => (c.rate_per_unit ?? 0) > 0 && (c.annual_unit_authorization ?? 0) > 0,
    );
    const hasStaff = (staffCount ?? 0) > 0;
    const evvReady = client.home_latitude != null && client.home_longitude != null;
    const guardianValid = guardianSatisfied(client.is_own_guardian, contacts);
    const goalsPresent = goalsOn(plans, today).goals.some((g) => g.status === "active");

    return {
      schedulable,
      hasStaff,
      evvReady,
      billable,
      guardianValid,
      goalsPresent,
      isLive: schedulable && hasStaff && evvReady,
      currentCodes,
      clockableCodes,
    };
  });

