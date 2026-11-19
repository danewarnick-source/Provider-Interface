// Rotation lines (B6): which days a line works and what each day's shift is.
// Pure; no I/O. A line (recurring_shift_patterns) is who + pattern + time slot,
// for a home (team_id) or a client. The pattern is either a cycle of on/off day
// counts counted from cycle_start ({5,2} = 5 on, 2 off; {2,2,3,2,2,3} = 2-2-3)
// or set weekdays (weekday_mask, bit 1 << weekday, Sunday = bit 0). All dates
// are America/Denver calendar days (time.ts); a slot whose end is at or before
// its start ends the next morning. Used by rotation-plan.ts (the builder),
// rotation-preview.ts (the editor's 4 weeks) and the Rotations screen.
import { timesOn } from "./board-model.ts";
import { addDaysKey, daysBetween, weekdayOf } from "./time.ts";

export type RotationLine = {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string | null;
  shift_type: string | null;
  cycle: number[] | null;
  cycle_start: string | null;
  weekday_mask: number;
  /** "HH:MM" or "HH:MM:SS", Denver wall clock. */
  start_time_local: string;
  end_time_local: string;
  effective_from: string;
  /** Last day the line runs (inclusive); null = never ends. */
  effective_until: string | null;
  active: boolean;
};

export type RotationSlot = { day: string; starts_at: string; ends_at: string };

/** How many days ahead drafts are kept, counting today. */
export const HORIZON_DAYS = 28;

export const PATTERNS = [
  { kind: "5-2", label: "5 on / 2 off", cycle: [5, 2] },
  { kind: "2-2-3", label: "2-2-3", cycle: [2, 2, 3, 2, 2, 3] },
  { kind: "4-4", label: "4 on / 4 off", cycle: [4, 4] },
  { kind: "4-3", label: "4 on / 3 off", cycle: [4, 3] },
  { kind: "weekdays", label: "Set weekdays", cycle: null },
  { kind: "alt-weekend", label: "Every other weekend", cycle: [2, 12] },
  { kind: "custom", label: "Custom cycle", cycle: null },
] as const;
export type PatternKind = (typeof PATTERNS)[number]["kind"];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const maskHas = (mask: number, weekday: number) => (mask & (1 << weekday)) !== 0;
export const maskOf = (weekdays: readonly number[]) => weekdays.reduce((m, d) => m | (1 << d), 0);

const sameCycle = (a: readonly number[] | null, b: readonly number[] | null) =>
  !!a && !!b && a.length === b.length && a.every((n, i) => n === b[i]);

/** The editor's pattern choice for a stored line. */
export function patternKind(line: Pick<RotationLine, "cycle" | "cycle_start">): PatternKind {
  if (!line.cycle?.length) return "weekdays";
  const preset = PATTERNS.find((p) => sameCycle(p.cycle, line.cycle));
  if (!preset) return "custom";
  // Every other weekend is 2 on / 12 off starting on a Saturday.
  if (preset.kind === "alt-weekend" && (!line.cycle_start || weekdayOf(line.cycle_start) !== 6))
    return "custom";
  return preset.kind;
}

/** "Mon–Fri", "Mon, Wed, Fri", "Every day". */
export function weekdaysLabel(mask: number): string {
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => maskHas(mask, d));
  if (days.length === 7) return "Every day";
  if (days.length >= 3 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1))
    return `${WEEKDAY_SHORT[days[0]!]}–${WEEKDAY_SHORT[days[days.length - 1]!]}`;
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** "5 on / 2 off", "2-2-3", "Mon, Wed", "6 on / 1 off", "3-2-2-3 cycle". */
export function patternLabel(line: Pick<RotationLine, "cycle" | "cycle_start" | "weekday_mask">) {
  const kind = patternKind(line);
  if (kind === "weekdays") return weekdaysLabel(line.weekday_mask);
  if (kind !== "custom") return PATTERNS.find((p) => p.kind === kind)!.label;
  const c = line.cycle ?? [];
  return c.length === 2 ? `${c[0]} on / ${c[1]} off` : `${c.join("-")} cycle`;
}

/**
 * "6-1" or "3-2-2-3" → [6,1] / [3,2,2,3]: day counts alternating on, off,
 * starting with on. null when it isn't a whole number of on/off pairs of 1–28 days.
 */
export function parseCycle(text: string): number[] | null {
  const parts = text
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
  if (!parts.length || parts.length % 2 !== 0) return null;
  if (parts.some((n) => !Number.isInteger(n) || n < 1 || n > 28)) return null;
  return parts;
}

/** True when a cycle works this many days after its start (negative = before it starts). */
function cycleWorks(cycle: readonly number[], offset: number): boolean {
  const length = cycle.reduce((n, d) => n + d, 0);
  if (offset < 0 || length <= 0) return false;
  let pos = offset % length;
  for (let i = 0; i < cycle.length; i++) {
    if (pos < cycle[i]!) return i % 2 === 0;
    pos -= cycle[i]!;
  }
  return false;
}

/** The days in [from, to] (inclusive) the line works, within its effective dates. */
export function rotationDays(line: RotationLine, from: string, to: string): string[] {
  if (!line.active) return [];
  const first = line.effective_from > from ? line.effective_from : from;
  const last = line.effective_until && line.effective_until < to ? line.effective_until : to;
  const out: string[] = [];
  for (let d = first; d <= last; d = addDaysKey(d, 1)) {
    const works = line.cycle?.length
      ? !!line.cycle_start && cycleWorks(line.cycle, daysBetween(line.cycle_start, d))
      : maskHas(line.weekday_mask, weekdayOf(d));
    if (works) out.push(d);
  }
  return out;
}

/** The line's shift on one day: Denver wall-clock times; an end at or before the start is the next day. */
export function slotOn(
  line: Pick<RotationLine, "start_time_local" | "end_time_local">,
  day: string,
): RotationSlot {
  return {
    day,
    ...timesOn(day, line.start_time_local.slice(0, 5), line.end_time_local.slice(0, 5)),
  };
}

export function rotationSlots(line: RotationLine, from: string, to: string): RotationSlot[] {
  return rotationDays(line, from, to).map((d) => slotOn(line, d));
}

/** True when the slot runs past midnight (stored as crosses_midnight). */
export function crossesMidnight(start: string, end: string): boolean {
  return end.slice(0, 5) <= start.slice(0, 5);
}

/** The last day a build that ran on `builtOn` covered. */
export const builtThroughOf = (builtOn: string) => addDaysKey(builtOn, HORIZON_DAYS - 1);
