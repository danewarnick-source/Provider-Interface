// Client list: pure pieces shared by the server call (list.functions.ts) and
// the page — next due item, readiness, filters, search terms and CSV. No Supabase here.

import { neutralizeCsvFormula } from "../csv-safe.ts";
import { isClockableServiceCode } from "../service-billing.ts";
import { daysUntil } from "./dates.ts";
import type { UnitsLeft } from "./units.ts";

export const LIST_VIEWS = ["active", "discharged"] as const;
export type ListView = (typeof LIST_VIEWS)[number];

/** account_status values that mean the client has left the agency. */
export const DISCHARGED_STATUSES = ["archived", "discharged"] as const;

export type DueItem = { label: string; date: string; days: number };

export type Readiness = {
  ready: boolean;
  /** Plain-English gaps, e.g. "No team member assigned". */
  missing: string[];
};

export type ClientListRow = {
  id: string;
  kind: "client" | "draft";
  first_name: string;
  last_name: string;
  photo_url: string | null;
  medicaid_id: string | null;
  client_pid: string | null;
  account_status: string | null;
  codes: string[];
  home: { id: string; name: string } | null;
  unitsLeft: UnitsLeft | null;
  nextDue: DueItem | null;
  staff: { id: string; name: string }[];
  readiness: Readiness;
};

export type ListFilters = {
  view: ListView;
  search: string;
  code: string | null;
  homeId: string | null;
  staffId: string | null;
};

/** Days before a due date that the list starts flagging it. */
export const DUE_SOON_DAYS = 14;
/** Share of an authorization left (percent) that counts as running low. */
export const LOW_UNITS_PCT = 10;

/** Words of a search box → lowercase terms (each must match name, Medicaid ID or PID). */
export function searchTerms(search: string): string[] {
  return search
    .toLowerCase()
    .replace(/[%_,()*\\"']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

/** The earliest upcoming (or overdue) item among the candidates; null when none. */
export function nextDueItem(
  candidates: readonly { label: string; date: string | null | undefined }[],
  now: Date = new Date(),
): DueItem | null {
  let best: DueItem | null = null;
  for (const c of candidates) {
    const days = daysUntil(c.date, now);
    if (days == null || !c.date) continue;
    if (!best || days < best.days) best = { label: c.label, date: c.date.slice(0, 10), days };
  }
  return best;
}

/** What a client still needs before staff can be scheduled and clock in. */
export function listReadiness(args: {
  codes: readonly string[];
  staffCount: number;
  hasPin: boolean;
  guardianOk: boolean;
}): Readiness {
  const missing: string[] = [];
  if (!args.codes.some((c) => isClockableServiceCode(c)))
    missing.push("No authorized service code");
  if (args.staffCount === 0) missing.push("No team member assigned");
  if (!args.hasPin) missing.push("No home pin (address not found)");
  if (!args.guardianOk) missing.push("Guardian not on file");
  return { ready: missing.length === 0, missing };
}

/** Code / home / staff filters (search and view are applied in the query). */
export function applyListFilters(
  rows: readonly ClientListRow[],
  f: Omit<ListFilters, "view" | "search">,
): ClientListRow[] {
  const code = f.code?.toUpperCase() ?? null;
  return rows.filter((r) => {
    if (r.kind === "draft") return !code && !f.homeId && !f.staffId;
    if (code && !r.codes.includes(code)) return false;
    if (f.homeId && r.home?.id !== f.homeId) return false;
    if (f.staffId && !r.staff.some((s) => s.id === f.staffId)) return false;
    return true;
  });
}

/** Does a draft's display name match every search term? */
export function draftMatches(name: string, terms: readonly string[]): boolean {
  const n = name.toLowerCase();
  return terms.every((t) => n.includes(t));
}

export function sortRows(rows: ClientListRow[]): ClientListRow[] {
  return rows.sort(
    (a, b) =>
      (a.kind === "draft" ? 0 : 1) - (b.kind === "draft" ? 0 : 1) ||
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
  );
}

function csvCell(v: string): string {
  const safe = neutralizeCsvFormula(v);
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The list as shown, one line per client. */
export function clientListCsv(rows: readonly ClientListRow[]): string {
  const head = [
    "Name",
    "Medicaid ID",
    "DSPD PID",
    "Codes",
    "Home",
    "Lowest units left",
    "Next due",
    "Due date",
    "Team members",
    "Ready",
  ];
  const lines = rows.map((r) =>
    [
      `${r.first_name} ${r.last_name}`.trim(),
      r.medicaid_id ?? "",
      r.client_pid ?? "",
      r.codes.join(" "),
      r.home?.name ?? "",
      r.unitsLeft ? `${r.unitsLeft.code} ${r.unitsLeft.left} of ${r.unitsLeft.annual}` : "",
      r.nextDue?.label ?? "",
      r.nextDue?.date ?? "",
      r.staff.map((s) => s.name).join("; "),
      r.kind === "draft"
        ? "Finish setup"
        : r.readiness.ready
          ? "Yes"
          : r.readiness.missing.join("; "),
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
