// A client's recurring away times (client_away_times, B7): where they are on
// their standard week (day program, job, school, another provider), on which
// weekdays (weekday_mask, Sunday = bit 0) and from when to when (same day).
// Not billed; when every resident of a home is away, those hours need no
// staff (scheduler/coverage.ts). Edited on the client's profile and on the
// home page's Residents card through away-times.functions.ts. Pure.
import { WEEKDAY_SHORT, maskOf } from "../scheduler/rotation.ts";
import { daysText, timeText } from "../homes/staffing-needs.ts";

export const AWAY_LABELS = [
  ["day_program", "Day program"],
  ["job", "Job"],
  ["school", "School"],
  ["other_provider", "Another provider"],
  ["other", "Other"],
] as const;
export type AwayLabel = (typeof AWAY_LABELS)[number][0];

export type AwayTime = {
  id: string;
  client_id: string;
  weekday_mask: number;
  start_time: string;
  end_time: string;
  label: string;
  note: string | null;
};

export type AwayDraft = {
  days: number[];
  start: string;
  end: string;
  label: AwayLabel | "";
  note: string;
};

export const NOTE_MAX = 300;
export const emptyAway = (): AwayDraft => ({
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "15:00",
  label: "",
  note: "",
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What's wrong with an away time, in plain words; null when it can be saved. */
export function awayProblem(d: AwayDraft): string | null {
  if (!d.days.length) return "Pick at least one day.";
  if (!TIME.test(d.start) || !TIME.test(d.end))
    return "Enter when they leave and when they're back.";
  if (d.end <= d.start) return "They have to be back after they leave, the same day.";
  if (!AWAY_LABELS.some(([k]) => k === d.label)) return "Pick where they are.";
  if (d.note.length > NOTE_MAX) return `Keep the details under ${NOTE_MAX} characters.`;
  return null;
}

/** The weekdays in a mask, Sunday = 0. */
export const maskDays = (mask: number) =>
  WEEKDAY_SHORT.map((_, i) => i).filter((i) => (mask & (1 << i)) !== 0);

export const awayMask = (d: Pick<AwayDraft, "days">) => maskOf(d.days);

export const awayLabelText = (label: string) =>
  AWAY_LABELS.find(([k]) => k === label)?.[1] ?? "Away";

/** "Mon–Fri · 9:00 AM – 3:00 PM · Day program · Lehi Day Program". */
export function awayText(
  a: Pick<AwayTime, "weekday_mask" | "start_time" | "end_time" | "label" | "note">,
): string {
  return [
    daysText(maskDays(a.weekday_mask)),
    `${timeText(a.start_time.slice(0, 5))} – ${timeText(a.end_time.slice(0, 5))}`,
    awayLabelText(a.label),
    a.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
}
