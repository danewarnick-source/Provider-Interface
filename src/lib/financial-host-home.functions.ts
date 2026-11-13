// Server-fn wrapper for the Financial → Host Home tab.
//
// Mirrors the TNS Gross / Totals pattern: each read first enforces
// `view_financial_host_home` via requirePermission(), then runs the same
// query the route previously ran in the browser, using the USER-SCOPED
// context.supabase from requireSupabaseAuth. RLS still applies as the user.
// No supabaseAdmin. No RLS changes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/access/require";
import { hostOfClient, type HomeForHost } from "@/lib/homes/home-kind";

const PERM = "view_financial_host_home";

const OrgInput = z.object({ organizationId: z.string().uuid() });
const OrgMonthInput = z.object({
  organizationId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
const OrgClientsInput = z.object({
  organizationId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()),
});

export type HhHhsCode = { client_id: string; rate_per_unit: number };
/** host: the lead of the client's host home (read-only here; set on the home page). */
export type HhClient = {
  id: string;
  first_name: string;
  last_name: string;
  home: { id: string; name: string; isHostHome: boolean; hostName: string | null } | null;
};
export type HhDayRow = { client_id: string; record_date: string; billable: boolean };
export type HhSettings = { client_id: string; host_daily_rate: number };
export type HhMonthly = { client_id: string; activities_amount: number; room_and_board_amount: number };

async function gate(context: { supabase: unknown; userId: string }, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await requirePermission(context.supabase as any, context.userId, organizationId, PERM);
}

export const getHhCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgInput.parse(i))
  .handler(async ({ data, context }): Promise<HhHhsCode[]> => {
    if (!context.supabase || !context.userId) return [];
    await gate(context, data.organizationId);
    const { data: rows, error } = await context.supabase
      .from("client_billing_codes")
      .select("client_id, rate_per_unit")
      .eq("organization_id", data.organizationId)
      .eq("service_code", "HHS");
    if (error) throw error;
    return (rows ?? []) as HhHhsCode[];
  });

export const getHhClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgClientsInput.parse(i))
  .handler(async ({ data, context }): Promise<HhClient[]> => {
    if (!context.supabase || !context.userId) return [];
    await gate(context, data.organizationId);
    if (data.clientIds.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("clients")
      .select("id, first_name, last_name, team_id")
      .is("deleted_at", null)
      .in("id", data.clientIds)
      .order("last_name");
    if (error) throw error;
    const clients = (rows ?? []) as Array<Omit<HhClient, "home"> & { team_id: string | null }>;
    const homeIds = [...new Set(clients.map((c) => c.team_id).filter((x): x is string => !!x))];
    const { data: homeRows, error: hErr } = homeIds.length
      ? await context.supabase
          .from("teams")
          .select("id, team_name, team_type, manager_id")
          .eq("organization_id", data.organizationId)
          .in("id", homeIds)
      : { data: [], error: null };
    if (hErr) throw hErr;
    const homes = (homeRows ?? []) as Array<HomeForHost & { team_name: string }>;
    const homesById = new Map(homes.map((h) => [h.id, h]));
    const hostIds = [
      ...new Set(clients.map((c) => hostOfClient(c, homesById)).filter((x): x is string => !!x)),
    ];
    const { data: profs } = hostIds.length
      ? await context.supabase.from("profiles").select("id, full_name, email").in("id", hostIds)
      : { data: [] };
    const nameById = new Map(
      ((profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
        (p) => [p.id, p.full_name || p.email || "Host"],
      ),
    );
    return clients.map(({ team_id, ...c }) => {
      const home = team_id ? homesById.get(team_id) : undefined;
      const hostId = hostOfClient({ team_id }, homesById);
      return {
        ...c,
        home: home
          ? {
              id: home.id,
              name: home.team_name,
              isHostHome: home.team_type === "host_home",
              hostName: hostId ? (nameById.get(hostId) ?? "Host") : null,
            }
          : null,
      };
    });
  });

export const getHhDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgMonthInput.parse(i))
  .handler(async ({ data, context }): Promise<Record<string, number>> => {
    if (!context.supabase || !context.userId) return {};
    await gate(context, data.organizationId);
    const monthStart = new Date(data.year, data.month - 1, 1);
    const monthEnd = new Date(data.year, data.month, 1);
    const startIso = monthStart.toISOString().slice(0, 10);
    const endIso = monthEnd.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("hhs_daily_records_v")
      .select("client_id, record_date, billable, service_code")
      .eq("organization_id", data.organizationId)
      .eq("service_code", "HHS")
      .gte("record_date", startIso)
      .lt("record_date", endIso);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const r of (rows ?? []) as Array<{ client_id: string; billable: boolean }>) {
      if (r.billable) counts[r.client_id] = (counts[r.client_id] ?? 0) + 1;
    }
    return counts;
  });

export const getHhSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgInput.parse(i))
  .handler(async ({ data, context }): Promise<HhSettings[]> => {
    if (!context.supabase || !context.userId) return [];
    await gate(context, data.organizationId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("hhs_host_home_settings")
      .select("client_id, host_daily_rate")
      .eq("organization_id", data.organizationId);
    if (error) throw error;
    return (rows ?? []) as HhSettings[];
  });

export const getHhMonthly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgMonthInput.parse(i))
  .handler(async ({ data, context }): Promise<HhMonthly[]> => {
    if (!context.supabase || !context.userId) return [];
    await gate(context, data.organizationId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("hhs_host_home_monthly")
      .select("client_id, activities_amount, room_and_board_amount")
      .eq("organization_id", data.organizationId)
      .eq("year", data.year)
      .eq("month", data.month);
    if (error) throw error;
    return (rows ?? []) as HhMonthly[];
  });
