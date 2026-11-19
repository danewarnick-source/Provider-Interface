// "No staff needed" at a home (B7): a staffing need of 0 staff with its
// reason in notes (location_coverage_requirements, required by a CHECK),
// either every week on some weekdays or on one date (on_date). Saved from the
// gap dialog and the home page's "No staff needed" card through
// no-staff.functions.ts; coverage.ts greys those hours out. Settings › Homes
// shows and edits only weekly needs with people in them. Pure.
import { daysText, needDays, timeText, type NeedRow } from "./staffing-needs.ts";

export const NO_STAFF_WHY = [
  "At day program",
  "Away from home",
  "In the hospital",
  "Out with family",
  "Other",
] as const;

export type NoStaffDraft = {
  why: string;
  explanation: string;
  start: string;
  end: string;
  /** "once" = `date` only; "weekly" = every week on `days`. */
  often: "once" | "weekly";
  date: string;
  days: number[];
};

export type NoStaffRow = NeedRow & { on_date: string | null };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EXPLANATION_MAX = 400;

/** What's wrong with a block, in plain words; null when it can be saved. Start = end is all day. */
export function noStaffProblem(d: NoStaffDraft): string | null {
  if (!(NO_STAFF_WHY as readonly string[]).includes(d.why)) return "Pick why no staff is needed.";
  if (d.explanation.trim().length < 5) return "Explain why no one needs to be there.";
  if (d.explanation.length > EXPLANATION_MAX)
    return `Keep the explanation under ${EXPLANATION_MAX} characters.`;
  if (!TIME.test(d.start) || !TIME.test(d.end)) return "Enter a start and end time.";
  if (d.often === "once" ? !DATE.test(d.date) : d.days.length === 0)
    return d.often === "once" ? "Pick the date." : "Pick at least one day.";
  return null;
}

/** The reason as stored in notes: "At day program: All three residents are at Lehi." */
export const noStaffNotes = (d: Pick<NoStaffDraft, "why" | "explanation">) =>
  `${d.why}: ${d.explanation.trim()}`;

/** The rows to insert for a block (team and org added by the caller). */
export function noStaffRows(d: NoStaffDraft) {
  const base = {
    start_time: d.start,
    end_time: d.end,
    required_staff_count: 0,
    awake_required: false,
    notes: noStaffNotes(d),
  };
  return d.often === "once"
    ? [{ ...base, day_of_week: null, on_date: d.date }]
    : needDays(d.days).map((day) => ({ ...base, day_of_week: day, on_date: null }));
}

export type NoStaffBlock = {
  ids: string[];
  /** One date, or null for every week. */
  date: string | null;
  days: number[];
  start: string;
  end: string;
  reason: string;
};

/** 0-staff rows → blocks: one per date, or one per weekly time + reason across its days. */
export function noStaffBlocks(rows: readonly NoStaffRow[]): NoStaffBlock[] {
  const out = new Map<string, NoStaffBlock>();
  for (const r of rows.filter((x) => x.required_staff_count <= 0)) {
    const start = r.start_time.slice(0, 5);
    const end = r.end_time.slice(0, 5);
    const reason = (r.notes ?? "").trim();
    const key = [r.on_date ?? "weekly", start, end, reason].join("|");
    const b = out.get(key) ?? { ids: [], date: r.on_date, days: [], start, end, reason };
    b.ids.push(r.id);
    if (!r.on_date) {
      const add = r.day_of_week == null ? [0, 1, 2, 3, 4, 5, 6] : [r.day_of_week];
      b.days = [...new Set([...b.days, ...add])].sort((x, y) => x - y);
    }
    out.set(key, b);
  }
  return [...out.values()].sort(
    (a, b) =>
      (a.date ?? "").localeCompare(b.date ?? "") || a.start.localeCompare(b.start),
  );
}

/** "Mon–Fri · 9:00 AM – 3:00 PM" or "Every day · all day". */
export function noStaffWhen(b: Pick<NoStaffBlock, "days" | "start" | "end">, dateText?: string) {
  const when = dateText ?? daysText(b.days);
  const time =
    b.start === b.end ? "all day" : `${timeText(b.start)} – ${timeText(b.end)}${b.end < b.start ? " (next day)" : ""}`;
  return `${when} · ${time}`;
}
