/**
 * Scheduler time helpers. Every date decision in the scheduler goes through
 * here: America/Denver, weeks start on Sunday, and a "YYYY-MM-DD" string is a
 * calendar day, never a UTC instant (never `new Date("YYYY-MM-DD")`).
 */
import { DENVER_TZ, denverWallToIso, denverYmd, parseYmd } from "../denver-date.ts";

export const SCHEDULER_TIME_ZONE = DENVER_TZ;

/** Calendar day (YYYY-MM-DD) of an instant, in America/Denver. */
export function dayKey(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return denverYmd(d);
}

/** Midnight (America/Denver) at the start of a calendar day, as an instant. */
export function parseLocalDate(ymd: string): Date {
  if (!parseYmd(ymd)) throw new Error(`Invalid date: ${ymd}`);
  return new Date(denverWallToIso(ymd, 0, 0));
}

/** Calendar-day arithmetic that ignores DST and the runtime's time zone. */
export function addDaysKey(ymd: string, delta: number): string {
  const p = parseYmd(ymd);
  if (!p) throw new Error(`Invalid date: ${ymd}`);
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + delta));
  return dt.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromYmd` to `toYmd` (negative when earlier). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) throw new Error(`Invalid date: ${!a ? fromYmd : toYmd}`);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

/** Sunday = 0 … Saturday = 6 for a calendar day. */
export function weekdayOf(ymd: string): number {
  const p = parseYmd(ymd);
  if (!p) throw new Error(`Invalid date: ${ymd}`);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** The Sunday on or before a calendar day. */
export function weekStartKey(ymd: string): string {
  return addDaysKey(ymd, -weekdayOf(ymd));
}

/** Denver midnight on the Sunday that starts the week containing `input`. */
export function startOfWeek(input: Date | string): Date {
  return parseLocalDate(weekStartKey(dayKey(input)));
}

/**
 * UTC query bounds for a run of Denver calendar days.
 * `endYmd` is inclusive; the returned end is exclusive (midnight after it).
 */
export function toLocalRange(
  startYmd: string,
  endYmd: string = startYmd,
): { startIso: string; endExclusiveIso: string } {
  if (endYmd < startYmd) throw new Error("End date is before start date");
  return {
    startIso: parseLocalDate(startYmd).toISOString(),
    endExclusiveIso: parseLocalDate(addDaysKey(endYmd, 1)).toISOString(),
  };
}

/** Bounds of the Sunday-to-Saturday week containing `input`. */
export function weekRange(input: Date | string): { startIso: string; endExclusiveIso: string } {
  const start = weekStartKey(dayKey(input));
  return toLocalRange(start, addDaysKey(start, 6));
}

/** True when the instant falls on the inclusive Denver day range. */
export function isInDayRange(iso: string, startYmd: string, endYmd: string): boolean {
  const k = dayKey(iso);
  return k >= startYmd && k <= endYmd;
}

/** Shift an instant by whole Denver calendar days, keeping the wall-clock time. */
export function shiftByDays(iso: string, days: number): string {
  const d = new Date(iso);
  const ymd = dayKey(d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return denverWallToIso(addDaysKey(ymd, days), num("hour") % 24, num("minute"));
}
