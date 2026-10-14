// Month and people helpers for the MAR: the days of a month, whether it can
// be signed off yet, staff initials for the grid and the signature key, and
// the short "8:04a" time the grid shows. Pure; safe for browser and server.

import {
  DENVER_TZ,
  addCalendarMonths,
  daysInCalendarMonth,
  denverYmd,
  ymdFromParts,
} from "../denver-date.ts";

/** "2026-10" → { year, month }, or null when it isn't a month. */
export function parseMonth(month: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-01)?$/.exec(month.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  return year >= 2000 && mon >= 1 && mon <= 12 ? { year, month: mon } : null;
}

function mustParse(month: string) {
  const p = parseMonth(month);
  if (!p) throw new Error("Pick a month.");
  return p;
}

/** "2026-10" for the Denver month containing `now`. */
export function currentMonth(now: Date = new Date()): string {
  return denverYmd(now).slice(0, 7);
}

/** First day as YYYY-MM-01 (the medication_month_reviews.month value). */
export function monthStart(month: string): string {
  const p = mustParse(month);
  return ymdFromParts(p.year, p.month, 1);
}

export function monthEnd(month: string): string {
  const p = mustParse(month);
  return ymdFromParts(p.year, p.month, daysInCalendarMonth(p.year, p.month));
}

/** Every day of the month, YYYY-MM-DD. */
export function monthDays(month: string): string[] {
  const p = mustParse(month);
  const n = daysInCalendarMonth(p.year, p.month);
  return Array.from({ length: n }, (_, i) => ymdFromParts(p.year, p.month, i + 1));
}

export function shiftMonth(month: string, delta: number): string {
  const p = mustParse(month);
  const next = addCalendarMonths(p.year, p.month, delta);
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const p = mustParse(month);
  return new Date(Date.UTC(p.year, p.month - 1, 15)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A month can be signed off once its last day has passed (Denver time). */
export function canSignOffMonth(month: string, now: Date = new Date()): boolean {
  return denverYmd(now) > monthEnd(month);
}

/** "8:04a" in Denver time, or "" when the time is missing. */
export function shortTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase().startsWith("p") ? "p" : "a"}`;
}

/** "Oct 14, 2026 8:04 AM" in Denver time. */
export function longDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString("en-US", {
    timeZone: DENVER_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Tara Jones" → "TJ"; one word → its first two letters. */
export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export interface MarPerson {
  id: string;
  full_name: string | null;
  title?: string | null;
}

/** Staff id → initials, unique within the month ("TJ", then "TJ2"). Sorted by name first. */
export function staffInitials(people: readonly MarPerson[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Map<string, number>();
  const sorted = [...people].sort(
    (a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "") || a.id.localeCompare(b.id),
  );
  for (const p of sorted) {
    if (out.has(p.id)) continue;
    const base = initialsFor(p.full_name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    out.set(p.id, n === 1 ? base : `${base}${n}`);
  }
  return out;
}
