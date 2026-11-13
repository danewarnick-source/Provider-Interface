// Pure helpers for the scheduler board (components/scheduler/board/): which
// row and filter a shift belongs to, chip text, the times a drag or an edge
// drag produces, and the status a shift gets when its person changes. No I/O;
// every save still goes through saveShift and the rule engine.
import { denverWallToIso } from "../denver-date.ts";
import { homeKind } from "../homes/home-kind.ts";
import { addDaysKey, dayKey, daysBetween, shiftByDays, weekStartKey } from "./time.ts";

export type BoardShift = {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  published: boolean;
  parent_shift_id: string | null;
  open_spots: number | null;
  override_reason: string | null;
  shift_type: string;
  notes: string | null;
  claim_requested_by: string | null;
};
export type BoardTeam = { id: string; team_name: string; team_type: string | null };
export type BoardClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  team_id: string | null;
};

export type View = "homes" | "staff" | "clients";
export type Range = "week" | "month";

/** The code a home or program shift bills under (Decision 1); null where nobody is scheduled. */
export function homeCode(teamType: string | null | undefined): string | null {
  const kind = homeKind(teamType);
  return kind === "rhs_home" ? "RHS" : kind === "day_program" ? "DSG" : null;
}

export const isCancelled = (s: Pick<BoardShift, "status">) => s.status === "cancelled";
export const isOpenShift = (s: Pick<BoardShift, "staff_id" | "status">) =>
  !s.staff_id && !isCancelled(s);
export const shiftDay = (s: Pick<BoardShift, "starts_at">) => dayKey(s.starts_at);
export const shiftHours = (s: Pick<BoardShift, "starts_at" | "ends_at">) =>
  Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000);

export function weekDays(anyDay: string): string[] {
  const start = weekStartKey(anyDay);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
}

/** Hours on staffed, live shifts for one person. */
export function staffHours(shifts: readonly BoardShift[], staffId: string): number {
  const h = shifts
    .filter((s) => s.staff_id === staffId && !isCancelled(s))
    .reduce((n, s) => n + shiftHours(s), 0);
  return Math.round(h * 100) / 100;
}

/** "7a", "3:30p" in Denver time. */
export function fmtClock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const ap = get("dayPeriod").toLowerCase().startsWith("p") ? "p" : "a";
  return get("minute") === "00" ? `${get("hour")}${ap}` : `${get("hour")}:${get("minute")}${ap}`;
}
export const fmtSpan = (s: Pick<BoardShift, "starts_at" | "ends_at">) =>
  `${fmtClock(s.starts_at)}–${fmtClock(s.ends_at)}`;

/** Status after the person on a shift changes: same person keeps it; none is open; else draft or published. */
export function nextStatus(
  prev: Pick<BoardShift, "status" | "published" | "staff_id">,
  staffId: string | null,
): string {
  if (staffId === prev.staff_id && prev.status !== "cancelled") return prev.status;
  if (!staffId) return "open";
  return prev.published ? "published" : "draft";
}

/** Same wall-clock times on another day. */
export function moveTimes(s: Pick<BoardShift, "starts_at" | "ends_at">, toDay: string) {
  const days = daysBetween(dayKey(s.starts_at), toDay);
  return { starts_at: shiftByDays(s.starts_at, days), ends_at: shiftByDays(s.ends_at, days) };
}

const QUARTER = 15 * 60_000;

/** Drag the start or end edge by some minutes, snapped to quarter hours; keeps at least 15 minutes. */
export function resizeTimes(
  s: Pick<BoardShift, "starts_at" | "ends_at">,
  edge: "start" | "end",
  minutes: number,
) {
  const a = new Date(s.starts_at).getTime(),
    b = new Date(s.ends_at).getTime();
  const delta = Math.round(minutes / 15) * QUARTER;
  if (edge === "start")
    return {
      starts_at: new Date(Math.min(a + delta, b - QUARTER)).toISOString(),
      ends_at: s.ends_at,
    };
  return {
    starts_at: s.starts_at,
    ends_at: new Date(Math.max(b + delta, a + QUARTER)).toISOString(),
  };
}

/** "HH:MM" start and end on a day → instants; an end at or before the start is the next morning. */
export function timesOn(day: string, start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const overnight = eh! * 60 + em! <= sh! * 60 + sm!;
  return {
    starts_at: denverWallToIso(day, sh!, sm!),
    ends_at: denverWallToIso(overnight ? addDaysKey(day, 1) : day, eh!, em!),
  };
}

/** "HH:MM" Denver wall clock of an instant (for the time inputs). */
export function wallClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Denver",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export type FilterKey = string; // "all" | "community" | "host" | a teams.id

/** The filter chips: Everything, each staffed home or program, Community, Host homes. */
export function filterOptions(teams: readonly BoardTeam[]): { key: FilterKey; label: string }[] {
  return [
    { key: "all", label: "Everything" },
    ...teams.filter((t) => homeCode(t.team_type)).map((t) => ({ key: t.id, label: t.team_name })),
    { key: "community", label: "Community" },
    { key: "host", label: "Host homes" },
  ];
}

/** Where a client lives, as a filter: their staffed home, a host home, or the community. */
export function clientPlace(
  client: Pick<BoardClient, "team_id"> | undefined,
  teams: ReadonlyMap<string, BoardTeam>,
): FilterKey {
  const home = client?.team_id ? teams.get(client.team_id) : undefined;
  if (!home) return "community";
  if (homeKind(home.team_type) === "host_home") return "host";
  return homeCode(home.team_type) ? home.id : "community";
}

export function shiftPlace(
  s: Pick<BoardShift, "team_id" | "client_id">,
  clients: ReadonlyMap<string, BoardClient>,
  teams: ReadonlyMap<string, BoardTeam>,
): FilterKey {
  if (s.team_id && teams.has(s.team_id)) return s.team_id;
  return clientPlace(s.client_id ? clients.get(s.client_id) : undefined, teams);
}

export const inFilter = (filter: FilterKey, place: FilterKey) =>
  filter === "all" || filter === place;

export const clientName = (c: Pick<BoardClient, "first_name" | "last_name"> | undefined) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || "Client";

/** The fields saveShift takes, from a board shift plus changes. */
export function shiftWrite(organizationId: string, s: BoardShift, patch: Partial<BoardShift> = {}) {
  const n = { ...s, ...patch };
  return {
    id: n.id,
    organization_id: organizationId,
    staff_id: n.staff_id,
    client_id: n.client_id,
    team_id: n.team_id,
    service_code: n.service_code ?? "",
    starts_at: n.starts_at,
    ends_at: n.ends_at,
    shift_type: n.shift_type,
    status: n.status,
    published: n.published,
    notes: n.notes,
    override_reason: n.override_reason,
    open_spots: n.staff_id ? null : (n.open_spots ?? 1),
    parent_shift_id: n.parent_shift_id,
  };
}

/** A place a shift can be added at: a staffed home or program, or a client under one of their codes. */
export type PlaceOption = {
  key: string;
  label: string;
  teamId: string | null;
  clientId: string | null;
  code: string;
  /** Which shift types apply (shift_types.used_at). */
  usedAt: "home" | "program" | "client";
};

export type CodeRow = {
  client_id: string;
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
};

/** Codes nobody is scheduled under per client: host homes never clock, RHS is the home's shift. */
const HOME_ONLY_CODES = new Set(["HHS", "PPS", "RHS"]);

/** True when a 1056 row covers the day (its end date closes the code). */
export const codeActiveOn = (c: CodeRow, day: string) =>
  (!c.service_start_date || c.service_start_date <= day) &&
  (!c.service_end_date || day < c.service_end_date);

/** Where step of Add shift. `forClients` limits client places (a locked team member's caseload). */
export function placeOptions(
  day: string,
  teams: readonly BoardTeam[],
  clients: readonly BoardClient[],
  codes: readonly CodeRow[],
  forClients?: ReadonlySet<string>,
): PlaceOption[] {
  const homes = teams.flatMap((t): PlaceOption[] => {
    const code = homeCode(t.team_type);
    if (!code) return [];
    if (forClients && !clients.some((c) => c.team_id === t.id && forClients.has(c.id))) return [];
    return [
      {
        key: `team:${t.id}`,
        label: t.team_name,
        teamId: t.id,
        clientId: null,
        code,
        usedAt: code === "RHS" ? "home" : "program",
      },
    ];
  });
  const byId = new Map(clients.map((c) => [c.id, c]));
  const people = codes
    .filter(
      (c) =>
        byId.has(c.client_id) &&
        codeActiveOn(c, day) &&
        !HOME_ONLY_CODES.has(c.service_code.toUpperCase()),
    )
    .filter((c) => !forClients || forClients.has(c.client_id))
    .map((c): PlaceOption => ({
      key: `client:${c.client_id}:${c.service_code.toUpperCase()}`,
      label: `${clientName(byId.get(c.client_id))} · ${c.service_code.toUpperCase()}`,
      teamId: null,
      clientId: c.client_id,
      code: c.service_code.toUpperCase(),
      usedAt: "client",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...homes, ...people];
}
