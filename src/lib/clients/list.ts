// Client list: pure pieces shared by the server call (list.functions.ts) and
// the page — next due item, readiness, filters, search terms and CSV. No Supabase here.

import { neutralizeCsvFormula } from "../csv-safe.ts";
import { isClockableServiceCode } from "../service-billing.ts";
import { daysUntil, formatDate } from "./dates.ts";
import type { UnitsLeft } from "./units.ts";

export const LIST_VIEWS = ["active", "discharged"] as const;
export type ListView = (typeof LIST_VIEWS)[number];

/** account_status values that mean the client has left the agency. */
export const DISCHARGED_STATUSES = ["archived", "discharged"] as const;

/** What a due date belongs to: the plan year (PCSP), an authorization or a summary. */
export type DueKind = "plan" | "authorization" | "summary";
export type DueItem = { kind: DueKind; label: string; date: string; days: number };

/** Authorizations that have all ended (no active code left): the codes and the latest end date. */
export type EndedCodes = { codes: string[]; endedOn: string };

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
  preferred_name: string | null;
  photo_url: string | null;
  medicaid_id: string | null;
  client_pid: string | null;
  account_status: string | null;
  codes: string[];
  /** Set only when there are no active codes but some ended. */
  endedCodes: EndedCodes | null;
  /** No current plan, or its plan year has ended. */
  planExpired: boolean;
  home: { id: string; name: string } | null;
  unitsLeft: UnitsLeft | null;
  /** An active code has no yearly units on file. */
  needsUnits: boolean;
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
  candidates: readonly { kind: DueKind; label: string; date: string | null | undefined }[],
  now: Date = new Date(),
): DueItem | null {
  let best: DueItem | null = null;
  for (const c of candidates) {
    const days = daysUntil(c.date, now);
    if (days == null || !c.date) continue;
    if (!best || days < best.days)
      best = { kind: c.kind, label: c.label, date: c.date.slice(0, 10), days };
  }
  return best;
}

/** What a client still needs before staff can be scheduled and clock in. */
export function listReadiness(args: {
  codes: readonly string[];
  staffCount: number;
  hasPin: boolean;
  guardianOk: boolean;
  /** When every authorization has ended: the latest end date. */
  endedOn?: string | null;
}): Readiness {
  const missing: string[] = [];
  if (!args.codes.some((c) => isClockableServiceCode(c))) {
    missing.push(
      args.codes.length === 0 && args.endedOn
        ? `Authorizations ended ${formatDate(args.endedOn)}`
        : "No authorized service code",
    );
  }
  if (args.staffCount === 0) missing.push("No team member assigned");
  if (!args.hasPin) missing.push("No home pin (address not found)");
  if (!args.guardianOk) missing.push("Guardian not on file");
  return { ready: missing.length === 0, missing };
}

/**
 * Codes from authorization rows that have all ended, for a client with no
 * active code. null when any code is still active or none ever existed.
 */
export function endedCodesFor(
  activeCodes: readonly string[],
  endedRows: readonly { service_code: string | null; service_end_date: string | null }[],
): EndedCodes | null {
  if (activeCodes.length) return null;
  const codes = new Set<string>();
  let endedOn = "";
  for (const r of endedRows) {
    const code = String(r.service_code ?? "")
      .trim()
      .toUpperCase();
    const end = r.service_end_date?.slice(0, 10) ?? "";
    if (!code || !end) continue;
    codes.add(code);
    if (end > endedOn) endedOn = end;
  }
  return codes.size ? { codes: [...codes].sort(), endedOn } : null;
}

/** True when there is no current plan or its end date is before today (YYYY-MM-DD). */
export function planHasExpired(
  plans: readonly { end_date: string | null }[],
  today: string,
): boolean {
  if (!plans.length) return true;
  return !plans.some((p) => !p.end_date || p.end_date.slice(0, 10) >= today);
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
    "Ready to schedule",
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
