// Activity tab: shifts (one row per EVV timesheet), forms, incidents, and the
// person's account history from access_change_log. Any read error throws so
// the tab shows it instead of an empty "No activity".

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import {
  ACCOUNT_CHANGE_TYPES,
  type AccountSource,
  type FormSource,
  type IncidentSource,
  type MemberActivityData,
  type ShiftSource,
} from "@/lib/team-members/activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export const getMemberActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), staffId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MemberActivityData> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organizationId;
    const access = await requireCategory(supabase as Sb, userId, orgId, "staff_roster", "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;

    const { data: member, error: memErr } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", data.staffId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!member) throw new Error("Team member not found in this organization");
    if (access.scope !== "agency" && data.staffId !== userId) {
      const { data: visible, error } = await admin.rpc("access_can_see_staff", {
        _org: orgId,
        _staff: data.staffId,
        _viewer: userId,
      });
      if (error) throw new Error(error.message);
      if (visible !== true) throw new Error("Team member not found in this organization");
    }

    const [shifts, forms, incidents, account] = await Promise.all([
      admin
        .from("evv_timesheets")
        .select(
          "id, client_id, service_type_code, status, clock_in_timestamp, clock_out_timestamp, billed_units",
        )
        .eq("organization_id", orgId)
        .eq("staff_id", data.staffId)
        .order("clock_in_timestamp", { ascending: false })
        .limit(200),
      admin
        .from("form_submissions")
        .select("id, form_id, status, submitted_at, created_at")
        .eq("organization_id", orgId)
        .eq("submitted_by", data.staffId)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(100),
      admin
        .from("incident_reports")
        .select("id, report_number, status, incident_date, filed_at, incident_types")
        .eq("organization_id", orgId)
        .eq("reported_by", data.staffId)
        .order("filed_at", { ascending: false, nullsFirst: false })
        .limit(100),
      admin
        .from("access_change_log")
        .select("id, change_type, changed_by_name, created_at")
        .eq("organization_id", orgId)
        .eq("target_user_id", data.staffId)
        .in("change_type", [...ACCOUNT_CHANGE_TYPES])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    for (const r of [shifts, forms, incidents, account]) {
      if (r.error) throw new Error(r.error.message);
    }

    const shiftRows = (shifts.data ?? []) as Array<Omit<ShiftSource, "client_name">>;
    const clientIds = [
      ...new Set(shiftRows.map((r) => r.client_id).filter((x): x is string => !!x)),
    ];
    const clientName = new Map<string, string>();
    if (clientIds.length) {
      const { data: cs, error } = await admin
        .from("clients")
        .select("id, first_name, last_name")
        .eq("organization_id", orgId)
        .in("id", clientIds);
      if (error) throw new Error(error.message);
      for (const c of (cs ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
      }>) {
        clientName.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—");
      }
    }

    const formRows = (forms.data ?? []) as Array<
      Omit<FormSource, "form_name"> & { form_id: string | null }
    >;
    const formIds = [...new Set(formRows.map((r) => r.form_id).filter((x): x is string => !!x))];
    const formName = new Map<string, string>();
    if (formIds.length) {
      const { data: fs, error } = await admin.from("forms").select("id, name").in("id", formIds);
      if (error) throw new Error(error.message);
      for (const f of (fs ?? []) as Array<{ id: string; name: string | null }>) {
        formName.set(f.id, f.name ?? "Form");
      }
    }

    return {
      shifts: shiftRows.map((r) => ({
        ...r,
        client_name: r.client_id ? (clientName.get(r.client_id) ?? null) : null,
      })),
      forms: formRows.map(({ form_id, ...r }) => ({
        ...r,
        form_name: form_id ? (formName.get(form_id) ?? null) : null,
      })),
      incidents: (incidents.data ?? []) as IncidentSource[],
      account: (account.data ?? []) as AccountSource[],
    };
  });
