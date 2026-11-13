/**
 * teams → locations type mapping. `teams` is the source of truth for homes and
 * `teams.team_type` says what kind of home it is; the legacy scheduler
 * `locations` row is derived from it when a home is saved.
 */
import { homeKind } from "@/lib/homes/home-kind";

export type LocationType = "residential" | "host_home" | "day_site" | "community";

export function locationTypeForTeam(teamType: string | null | undefined): LocationType {
  const kind = homeKind(teamType);
  if (kind === "host_home") return "host_home";
  if (kind === "day_program") return "day_site";
  return "residential";
}
