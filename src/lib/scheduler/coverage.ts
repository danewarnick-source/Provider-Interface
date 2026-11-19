// Coverage at a staffed home (B7): per day, needed vs scheduled staff in
// 15-minute slots from 7a to 7a the next morning, and the merged stretches
// where it's short (gaps). Pure; the home page, the board (tile and gap bars),
// the gap dialog and Needs you all call homeCoverage, so they never disagree.
// Needed = the home's staffing needs (weekly, or one date), except where a
// "no staff needed" block (a 0-staff need, with its reason) covers the time,
// or every resident is away (Decision 15; one resident home keeps it needed).
// Scheduled = distinct people on shifts at the home that count toward
// coverage: not open, not cancelled, no client (an RHS 1:1 names its client
// and never counts, Decision 16), not a 1:1 segment, not on-call, not a shift
// type set to not count; anyone inside a 1:1 segment of their home shift is
// taken off for that time. All times are Denver wall clock, in minutes.
import { wallClock, type BoardShift } from "./board-model.ts";
import { denverWallToIso } from "../denver-date.ts";
import { addDaysKey, dayKey, daysBetween, weekdayOf } from "./time.ts";

export const SLOT_MIN = 15;
/** The bar for a day runs 7a to 7a: minutes from that day's midnight. */
export const BAR_FROM = 7 * 60;
export const BAR_TO = BAR_FROM + 24 * 60;

export type CoverageNeed = {
  id: string;
  team_id: string;
  day_of_week: number | null;
  on_date: string | null;
  start_time: string;
  end_time: string;
  required_staff_count: number;
  notes: string | null;
};
export type CoverageAway = {
  client_id: string;
  weekday_mask: number;
  start_time: string;
  end_time: string;
};
export type CoverageShift = Pick<
  BoardShift,
  | "id"
  | "staff_id"
  | "client_id"
  | "team_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "parent_shift_id"
  | "shift_type"
>;

export type CoverageInput = {
  teamId: string;
  needs: readonly CoverageNeed[];
  away: readonly CoverageAway[];
  /** Client ids living at the home now. */
  residents: readonly string[];
  shifts: readonly CoverageShift[];
  /** Shift type keys that don't count toward coverage (on-call always added). */
  notCounted: ReadonlySet<string>;
  days: readonly string[];
};

export type SlotState = "covered" | "short" | "none";
export type Slot = {
  /** Minutes from the bar day's midnight (420 … 1845). */
  at: number;
  needed: number;
  scheduled: number;
  state: SlotState;
  /** Why nothing is needed when a need was there. */
  off: "no_staff" | "away" | null;
};
export type Gap = { teamId: string; day: string; from: number; to: number; short: number };
/** A "no staff needed" block as it falls on one bar. */
export type NoStaffOnDay = { id: string; from: number; to: number; reason: string; weekly: boolean };
export type CoverageDay = {
  day: string;
  slots: Slot[];
  gaps: Gap[];
  noStaff: NoStaffOnDay[];
  neededHours: number;
  shortHours: number;
};

/** "15:30:00" → 930. */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** 930 → "3:30p"; 1440 → "12a". */
export function minuteClock(m: number): string {
  const day = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(day / 60);
  const mm = day % 60;
  const ap = h < 12 ? "a" : "p";
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${ap}`;
}
export const minuteSpan = (from: number, to: number) => `${minuteClock(from)}–${minuteClock(to)}`;

/** "HH:MM" of a minute count (wraps past midnight). */
export const minuteHhmm = (m: number) => {
  const day = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
};

/** A gap or block on a bar → the calendar day it starts on and its "HH:MM" times. */
export function onCalendar(barDay: string, from: number, to: number) {
  return {
    day: addDaysKey(barDay, Math.floor(from / 1440)),
    start: minuteHhmm(from),
    end: minuteHhmm(to),
  };
}

/** The instant of a minute on a bar (Denver wall clock). */
export function barInstant(barDay: string, m: number): string {
  const day = addDaysKey(barDay, Math.floor(m / 1440));
  const [h, mm] = minuteHhmm(m).split(":").map(Number);
  return denverWallToIso(day, h!, mm!);
}

/** Minutes of an instant from `ref` day's midnight, Denver wall clock. */
function wallMinutes(iso: string, ref: string): number {
  return daysBetween(ref, dayKey(iso)) * 1440 + toMinutes(wallClock(iso));
}

type Span = { from: number; to: number };
const within = (s: Span, mid: number) => s.from <= mid && mid < s.to;

/** Where a need falls on calendar day `day`, in minutes from `ref`; null when it doesn't apply. */
function needSpan(n: CoverageNeed, day: string, ref: string): Span | null {
  const applies = n.on_date
    ? n.on_date === day
    : n.day_of_week == null || n.day_of_week === weekdayOf(day);
  if (!applies) return null;
  const base = daysBetween(ref, day) * 1440;
  const a = toMinutes(n.start_time);
  let b = toMinutes(n.end_time);
  if (b <= a) b += 1440;
  return { from: base + a, to: base + b };
}

function awayAt(away: readonly CoverageAway[], clientId: string, ref: string, t: number): boolean {
  const day = addDaysKey(ref, Math.floor(t / 1440));
  const m = t - Math.floor(t / 1440) * 1440;
  const wd = weekdayOf(day);
  return away.some(
    (x) =>
      x.client_id === clientId &&
      (x.weekday_mask & (1 << wd)) !== 0 &&
      toMinutes(x.start_time) <= m &&
      m + SLOT_MIN <= toMinutes(x.end_time),
  );
}

/** Does this shift count toward the home's coverage? */
export function countsTowardCoverage(s: CoverageShift, teamId: string, notCounted: ReadonlySet<string>) {
  return (
    s.team_id === teamId &&
    !s.client_id &&
    !s.parent_shift_id &&
    !!s.staff_id &&
    s.status !== "cancelled" &&
    s.shift_type !== "oncall" &&
    !notCounted.has(s.shift_type)
  );
}

function coverageDay(i: CoverageInput, day: string): CoverageDay {
  const ref = day;
  const needs = i.needs.filter((n) => n.team_id === i.teamId);
  const spans = [-1, 0, 1].flatMap((k) =>
    needs.flatMap((n) => {
      const s = needSpan(n, addDaysKey(day, k), ref);
      return s ? [{ ...s, n }] : [];
    }),
  );
  const positive = spans.filter((s) => s.n.required_staff_count > 0);
  const zero = spans.filter((s) => s.n.required_staff_count <= 0);
  const counted = i.shifts.filter((s) => countsTowardCoverage(s, i.teamId, i.notCounted));
  const countedIds = new Set(counted.map((s) => s.id));
  const toSpan = (s: CoverageShift) => ({
    from: wallMinutes(s.starts_at, ref),
    to: wallMinutes(s.ends_at, ref),
  });
  const work = counted.map((s) => ({ staff: s.staff_id!, ...toSpan(s) }));
  const segments = i.shifts
    .filter(
      (s) =>
        !!s.parent_shift_id &&
        countedIds.has(s.parent_shift_id) &&
        !!s.staff_id &&
        s.status !== "cancelled",
    )
    .map((s) => ({ staff: s.staff_id!, ...toSpan(s) }));

  const slots: Slot[] = [];
  for (let at = BAR_FROM; at < BAR_TO; at += SLOT_MIN) {
    const mid = at + SLOT_MIN / 2;
    const want = positive.filter((s) => within(s, mid)).reduce((n, s) => Math.max(n, s.n.required_staff_count), 0);
    const noStaff = zero.some((s) => within(s, mid));
    const away =
      !noStaff &&
      want > 0 &&
      i.residents.length > 0 &&
      i.residents.every((r) => awayAt(i.away, r, ref, at));
    const needed = noStaff || away ? 0 : want;
    const people = new Set(work.filter((w) => within(w, mid)).map((w) => w.staff));
    for (const g of segments) if (within(g, mid)) people.delete(g.staff);
    const scheduled = people.size;
    slots.push({
      at,
      needed,
      scheduled,
      state: needed === 0 ? "none" : scheduled >= needed ? "covered" : "short",
      off: want > 0 && needed === 0 ? (noStaff ? "no_staff" : "away") : null,
    });
  }

  const gaps: Gap[] = [];
  let g: Gap | null = null;
  for (const s of slots) {
    if (s.state === "short") {
      const short = s.needed - s.scheduled;
      if (g) {
        g.to = s.at + SLOT_MIN;
        g.short = Math.max(g.short, short);
      } else g = { teamId: i.teamId, day, from: s.at, to: s.at + SLOT_MIN, short };
    } else if (g) {
      gaps.push(g);
      g = null;
    }
  }
  if (g) gaps.push(g);

  const noStaff = zero
    .filter((s) => s.from < BAR_TO && s.to > BAR_FROM)
    .map((s) => ({
      id: s.n.id,
      from: s.from,
      to: s.to,
      reason: (s.n.notes ?? "").trim(),
      weekly: !s.n.on_date,
    }));
  const hours = (st: SlotState[]) =>
    (slots.filter((s) => st.includes(s.state)).length * SLOT_MIN) / 60;
  return {
    day,
    slots,
    gaps,
    noStaff,
    neededHours: hours(["covered", "short"]),
    shortHours: hours(["short"]),
  };
}

export function homeCoverage(i: CoverageInput): CoverageDay[] {
  return i.days.map((d) => coverageDay(i, d));
}

/** True when the home has any staffing need with people in it. */
export const hasStaffingNeeds = (needs: readonly CoverageNeed[], teamId?: string) =>
  needs.some((n) => n.required_staff_count > 0 && (!teamId || n.team_id === teamId));

/** The open (unfilled) shift at the home that overlaps a gap, if any. */
export function openShiftFor(gap: Gap, shifts: readonly CoverageShift[]): CoverageShift | null {
  return (
    shifts.find((s) => {
      if (s.team_id !== gap.teamId || s.client_id || s.parent_shift_id) return false;
      if (s.staff_id || s.status === "cancelled") return false;
      const from = wallMinutes(s.starts_at, gap.day);
      const to = wallMinutes(s.ends_at, gap.day);
      return from < gap.to && to > gap.from;
    }) ?? null
  );
}
