// The rotation editor's 4-week preview (B6): per week, the days the line
// works, its hours, and flags (time off → open, a card expiring, overtime,
// days skipped because someone already has a shift). Pure; the dates and hours
// come from rotation.ts straight away, the flags from the rule engine
// (previewRotation in rotation.functions.ts) once they load.
import { fmtDay } from "./auth-outlook.ts";
import { weekSpan } from "./copy-week.ts";
import { shiftHours } from "./board-model.ts";
import { weekStartKey } from "./time.ts";
import type { RotationSlot } from "./rotation.ts";

/** How one day lands: a draft (maybe with a warning), an open shift, or skipped. */
export type DayOutcome = { day: string; as: "draft" | "open" | "skip"; message: string | null };

export type PreviewWeek = {
  week: string;
  label: string;
  days: string[];
  hours: number;
  open: number;
  flags: { tone: "warn" | "crit"; text: string }[];
};

const short = (day: string) => fmtDay(day).replace(/, \d{4}$/, "");

export function rotationPreview(
  slots: readonly RotationSlot[],
  outcomes: readonly DayOutcome[],
): PreviewWeek[] {
  const byDay = new Map(outcomes.map((o) => [o.day, o]));
  const weeks = new Map<string, PreviewWeek>();
  for (const s of slots) {
    const week = weekStartKey(s.day);
    const w =
      weeks.get(week) ??
      weeks
        .set(week, { week, label: weekSpan(week), days: [], hours: 0, open: 0, flags: [] })
        .get(week)!;
    const o = byDay.get(s.day);
    if (o?.as === "skip") {
      w.flags.push({
        tone: "warn",
        text: `${short(s.day)} skipped: ${o.message ?? "already booked"}`,
      });
      continue;
    }
    w.days.push(s.day);
    w.hours = Math.round((w.hours + shiftHours(s)) * 100) / 100;
    if (o?.as === "open") {
      w.open += 1;
      w.flags.push({
        tone: "crit",
        text: `${short(s.day)} → open: ${o.message ?? "can't take it"}`,
      });
    } else if (o?.message) {
      w.flags.push({ tone: "warn", text: `${short(s.day)}: ${o.message}` });
    }
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}
