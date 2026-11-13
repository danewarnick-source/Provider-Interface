// The authorization outlook on the scheduler board's Clients view (the 1056
// panel): authorized vs used + scheduled for the plan year, what's left, the
// standard week, and whether the client is on pace. Pure. The board's data hook
// (components/scheduler/board/use-auth-outlook.ts) loads client_billing_codes,
// clock-ins and shifts and calls these. Units are per entry (computeEntryUnits:
// each entry rounds to the nearest quarter hour, never a summed total); daily
// codes count days.
import { computeEntryUnits } from "../billing-units.ts";
import { DAILY_UNIT_CODES } from "./billing-mode.ts";
import { addDaysKey, dayKey, daysBetween } from "./time.ts";

export type OutlookStatus = "ok" | "watch" | "act" | "under";

export const OUTLOOK_LABEL: Record<OutlookStatus, string> = {
  ok: "On pace",
  watch: "Watch",
  act: "Act now",
  under: "Under-using",
};

export type OutlookInput = {
  /** Authorized for the plan year, in units (days for a daily code). */
  authorized: number;
  /** Used before this week (clock-ins, or billable days). */
  usedBefore: number;
  /** On this week's schedule. */
  scheduledThisWeek: number;
  /** Units a usual week uses (the next 4 weeks' schedule, averaged). */
  standardWeek: number;
  /** Saturday that ends this week (YYYY-MM-DD). */
  weekEnd: string;
  /** Last day of the plan year (YYYY-MM-DD). */
  planEnd: string;
};

export type Outlook = {
  used: number;
  left: number;
  status: OutlookStatus;
  /** About when the units run out at the standard week, if before the plan year ends. */
  runsOutOn: string | null;
  weeksEarly: number | null;
  /** Units left over at the end of the plan year at this pace. */
  unused: number | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function authOutlook(i: OutlookInput): Outlook {
  const used = round(i.usedBefore + i.scheduledThisWeek);
  const left = round(i.authorized - used);
  const weeksLeft = Math.max(0, daysBetween(i.weekEnd, i.planEnd) / 7);
  const base = { used, left, runsOutOn: null, weeksEarly: null, unused: null };
  if (left < 0) return { ...base, status: "act" };
  const lastsWeeks = i.standardWeek > 0 ? left / i.standardWeek : Infinity;
  if (lastsWeeks < weeksLeft - 1) {
    return {
      ...base,
      status: lastsWeeks < 4 ? "act" : "watch",
      runsOutOn: addDaysKey(i.weekEnd, Math.round(lastsWeeks * 7)),
      weeksEarly: Math.round(weeksLeft - lastsWeeks),
    };
  }
  const unused = round(left - i.standardWeek * weeksLeft);
  if (unused > i.standardWeek * 2) return { ...base, status: "under", unused };
  return { ...base, status: "ok" };
}

/** "Oct 22, 2026" for a calendar day. */
export function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The one line next to the outlook pill. `unit` is "h" or "days". */
export function outlookMessage(o: Outlook, unit: string): string {
  if (o.left < 0) return `Over by ${Math.abs(o.left)} ${unit}.`;
  if (o.runsOutOn)
    return `Runs out about ${fmtDay(o.runsOutOn)}, ${o.weeksEarly} weeks before the plan year ends.`;
  if (o.status === "under") return `About ${o.unused} ${unit} will go unused at this pace.`;
  return "On pace to the end of the plan year.";
}

export function isDailyCode(code: string): boolean {
  return DAILY_UNIT_CODES.includes(code.toUpperCase());
}

/** Plan year bounds from a 1056 row. The end date closes the code (that day is not covered). */
export function planYearOf(
  start: string | null,
  end: string | null,
): { start: string; end: string } | null {
  if (start) return { start, end: end ? addDaysKey(end, -1) : addDaysKey(addYears(start, 1), -1) };
  if (end) return { start: addYears(end, -1), end: addDaysKey(end, -1) };
  return null;
}

function addYears(ymd: string, n: number): string {
  return `${Number(ymd.slice(0, 4)) + n}${ymd.slice(4)}`;
}

export type Entry = { start: string; end: string | null };

/** Units for a set of entries of one code: quarter hours per entry, or distinct days for a daily code. */
export function usageUnits(code: string, entries: readonly Entry[]): number {
  if (isDailyCode(code)) return new Set(entries.map((e) => dayKey(e.start))).size;
  return entries.reduce((n, e) => n + computeEntryUnits(e.start, e.end), 0);
}

/** Display amount: hours for quarter-hour codes, days for daily codes. */
export function inDisplayUnits(code: string, units: number): number {
  return isDailyCode(code) ? units : round(units / 4);
}
