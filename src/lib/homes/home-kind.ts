// What kind of home a team is, and who a client's host is. Pure: no I/O.
//
// One owner per fact (docs/SOURCE_OF_TRUTH.md):
//   - the kind of home is `teams.team_type`;
//   - a home's lead is `teams.manager_id` (a profiles id). On a host home the lead
//     is the host;
//   - where a client lives is `clients.team_id`.
// So a client's host is the lead of the client's home, when that home is a host
// home. Callers: the homes board and home page, the client profile header, Daily
// Logs' missing host-home notes, and Finances › Host home.

export type HomeKind = "rhs_home" | "host_home" | "day_program" | "other";

export const HOME_KINDS: readonly { value: HomeKind; label: string }[] = [
  { value: "rhs_home", label: "Group home (RHS)" },
  { value: "host_home", label: "Host home" },
  { value: "day_program", label: "Day program" },
  { value: "other", label: "Other" },
];

export function homeKind(teamType: string | null | undefined): HomeKind {
  return HOME_KINDS.some((k) => k.value === teamType) ? (teamType as HomeKind) : "other";
}

export function homeKindLabel(teamType: string | null | undefined): string {
  const kind = homeKind(teamType);
  return HOME_KINDS.find((k) => k.value === kind)?.label ?? "Other";
}

/** What the lead is called on this home: "Host" on a host home, "Lead" everywhere else. */
export function leadLabel(teamType: string | null | undefined): "Host" | "Lead" {
  return homeKind(teamType) === "host_home" ? "Host" : "Lead";
}

export type HomeForHost = { id: string; team_type: string | null; manager_id: string | null };

/**
 * The client's host: the lead of the client's home when that home is a host home.
 * null when the client has no home, the home isn't a host home, or it has no lead yet.
 */
export function hostOfClient(
  client: { team_id: string | null | undefined },
  homesById: ReadonlyMap<string, HomeForHost>,
): string | null {
  if (!client.team_id) return null;
  const home = homesById.get(client.team_id);
  if (!home || homeKind(home.team_type) !== "host_home") return null;
  return home.manager_id ?? null;
}

/** "no home" | "not a host home" | "host home with no host" | "host home with a host". */
export type HostState = "no_home" | "not_host_home" | "no_host" | "has_host";

export function hostState(
  client: { team_id: string | null | undefined },
  homesById: ReadonlyMap<string, HomeForHost>,
): HostState {
  if (!client.team_id) return "no_home";
  const home = homesById.get(client.team_id);
  if (!home || homeKind(home.team_type) !== "host_home") return "not_host_home";
  return home.manager_id ? "has_host" : "no_host";
}
