// Loads what coverage needs at every staffed home of an agency (B7): the
// staffing needs and "no staff needed" blocks (location_coverage_requirements
// by team), the residents (clients whose Home is the home and who haven't
// left), their away times (client_away_times, not archived) and the shift
// types that don't count toward coverage. Takes the db client so the board
// (browser, board-data.ts) and Needs you (server, needs.server.ts) read the
// same rows under the caller's RLS. homesCoverage runs coverage.ts per home.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DISCHARGED_STATUSES } from "@/lib/clients/list/list";
import { homeCode, type BoardTeam } from "./board-model";
import {
  hasStaffingNeeds,
  homeCoverage,
  type CoverageAway,
  type CoverageDay,
  type CoverageNeed,
  type CoverageShift,
} from "./coverage";

type Db = SupabaseClient<Database>;

export type CoverageData = {
  needs: CoverageNeed[];
  away: CoverageAway[];
  residents: { id: string; team_id: string }[];
  /** Shift type keys set to not count toward coverage. */
  notCounted: string[];
};

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

export async function loadCoverageData(db: Db, orgId: string): Promise<CoverageData> {
  const [needs, residents, types] = await Promise.all([
    db
      .from("location_coverage_requirements")
      .select(
        "id, team_id, day_of_week, on_date, start_time, end_time, required_staff_count, notes",
      )
      .eq("organization_id", orgId),
    db
      .from("clients")
      .select("id, team_id")
      .eq("organization_id", orgId)
      .not("team_id", "is", null)
      .is("deleted_at", null)
      .or(`account_status.is.null,account_status.not.in.(${DISCHARGED_STATUSES.join(",")})`),
    db
      .from("shift_types")
      .select("key")
      .eq("organization_id", orgId)
      .eq("counts_toward_coverage", false),
  ]);
  const people = must(residents) as { id: string; team_id: string }[];
  const away = people.length
    ? must(
        await db
          .from("client_away_times")
          .select("client_id, weekday_mask, start_time, end_time")
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in(
            "client_id",
            people.map((p) => p.id),
          ),
      )
    : [];
  return {
    needs: must(needs),
    away,
    residents: people,
    notCounted: must(types)
      .map((t) => t.key)
      .filter((k): k is string => !!k),
  };
}

/** Coverage per staffed home that has staffing needs, for these days. */
export function homesCoverage(
  teams: readonly BoardTeam[],
  data: CoverageData,
  shifts: readonly CoverageShift[],
  days: readonly string[],
): Map<string, CoverageDay[]> {
  const notCounted = new Set(data.notCounted);
  const out = new Map<string, CoverageDay[]>();
  for (const t of teams) {
    if (!homeCode(t.team_type) || !hasStaffingNeeds(data.needs, t.id)) continue;
    out.set(
      t.id,
      homeCoverage({
        teamId: t.id,
        needs: data.needs,
        away: data.away,
        residents: data.residents.filter((r) => r.team_id === t.id).map((r) => r.id),
        shifts,
        notCounted,
        days,
      }),
    );
  }
  return out;
}
