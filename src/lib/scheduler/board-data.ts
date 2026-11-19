// Reads for the scheduler board (components/scheduler/board/), run as the
// signed-in user (RLS applies). loadBoardData: clients, homes (teams), active
// team members (organization_members, then profiles: two queries joined here,
// never an embed), shifts in range, each client's 1056 codes, caseloads, time
// off, shift types (B2 Settings) and the overtime threshold. The 1056 outlook
// loads in auth-outlook-load.ts.
import { supabase } from "@/integrations/supabase/client";
import type { BoardClient, BoardShift, BoardTeam } from "@/lib/scheduler/board-model";

export type BoardStaff = { id: string; name: string };
export type BoardCode = {
  client_id: string;
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
};
export type BoardTimeOff = {
  staff_id: string;
  start_date: string;
  end_date: string;
  status: string;
};
export type BoardShiftType = {
  key: string | null;
  name: string;
  start_time: string;
  end_time: string;
  used_at: string[];
};
export type BoardAssign = { staff_id: string; client_id: string };

export type BoardData = {
  clients: BoardClient[];
  teams: BoardTeam[];
  staff: BoardStaff[];
  shifts: BoardShift[];
  codes: BoardCode[];
  assigns: BoardAssign[];
  timeOff: BoardTimeOff[];
  shiftTypes: BoardShiftType[];
  otHours: number;
};

const SHIFT_SELECT =
  "id, staff_id, client_id, team_id, service_code, starts_at, ends_at, status, published, parent_shift_id, open_spots, override_reason, shift_type, notes, claim_requested_by";

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

const nameOf = (p: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}) =>
  (p.full_name ?? "").trim() ||
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
  "Team member";

export type BoardRange = { startIso: string; endIso: string; from: string; to: string };

export async function loadBoardData(orgId: string, range: BoardRange): Promise<BoardData> {
  const org = orgId;
  const [clients, teams, members, shifts, codes, assigns, timeOff, types, settings] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, first_name, last_name, team_id")
        .eq("organization_id", org)
        .is("deleted_at", null),
      supabase
        .from("teams")
        .select("id, team_name, team_type")
        .eq("organization_id", org)
        .eq("active", true)
        .order("team_name"),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org)
        .eq("active", true)
        .is("deleted_at", null),
      supabase
        .from("scheduled_shifts")
        .select(SHIFT_SELECT)
        .eq("organization_id", org)
        .gte("starts_at", range.startIso)
        .lt("starts_at", range.endIso)
        .order("starts_at"),
      supabase
        .from("client_billing_codes")
        .select("client_id, service_code, service_start_date, service_end_date")
        .eq("organization_id", org),
      supabase.from("staff_assignments").select("staff_id, client_id").eq("organization_id", org),
      supabase
        .from("time_off_requests")
        .select("staff_id, start_date, end_date, status")
        .eq("organization_id", org)
        .in("status", ["approved", "pending"])
        .lte("start_date", range.to)
        .gte("end_date", range.from),
      supabase
        .from("shift_types")
        .select("key, name, start_time, end_time, used_at")
        .eq("organization_id", org)
        .is("archived_at", null)
        .order("start_time"),
      supabase
        .from("org_shift_behavior_settings")
        .select("ot_threshold_hours")
        .eq("organization_id", org)
        .maybeSingle(),
    ]);
  const ids = [
    ...new Set(
      must(members)
        .map((m) => m.user_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const profiles = ids.length
    ? must(
        await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", ids),
      )
    : [];
  return {
    clients: must(clients),
    teams: must(teams),
    staff: profiles
      .map((p) => ({ id: p.id, name: nameOf(p) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    shifts: must(shifts) as BoardShift[],
    codes: must(codes),
    assigns: must(assigns),
    timeOff: must(timeOff),
    shiftTypes: must(types),
    otHours: Number(settings.data?.ot_threshold_hours ?? 40),
  };
}
