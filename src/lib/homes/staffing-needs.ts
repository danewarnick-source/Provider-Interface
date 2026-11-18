// A home's staffing needs: how many staff it needs, on which days, and when.
// Stored one row per day in location_coverage_requirements (team_id = the
// home; day_of_week 0 = Sunday … 6 = Saturday, null = every day). Settings ›
// Homes shows and edits them as time blocks: rows with the same times, staff
// count, awake flag and notes are one block across their days. Pure: the
// home page and staffing-needs.functions.ts call these. Hidden on host homes.

export type NeedRow = {
  id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  required_staff_count: number;
  awake_required: boolean;
  notes: string | null;
};

export type NeedBlock = {
  /** The rows this block stands for (empty for a new block). */
  ids: string[];
  /** 0 = Sunday … 6 = Saturday, sorted; all seven = every day. */
  days: number[];
  /** "HH:MM", 24-hour. An end at or before the start runs past midnight. */
  start: string;
  end: string;
  staff: number;
  awake: boolean;
  notes: string;
};

/** Day labels by day_of_week, and the order the editor shows them (Mon first). */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const MAX_STAFF = 20;

export const emptyBlock = (): NeedBlock => ({
  ids: [],
  days: [],
  start: "",
  end: "",
  staff: 1,
  awake: false,
  notes: "",
});

/** "15:00:00" → "15:00". */
export const hhmm = (t: string) => t.slice(0, 5);

const weekPos = (d: number) => WEEK_ORDER.indexOf(d as (typeof WEEK_ORDER)[number]);
const byWeek = (a: number, b: number) => weekPos(a) - weekPos(b);

/** Rows → time blocks, earliest start first, then by first day of the week. */
export function groupNeeds(rows: readonly NeedRow[]): NeedBlock[] {
  const blocks = new Map<string, NeedBlock>();
  for (const r of rows) {
    const notes = (r.notes ?? "").trim();
    const key = [
      hhmm(r.start_time),
      hhmm(r.end_time),
      r.required_staff_count,
      r.awake_required,
      notes,
    ].join("|");
    const b = blocks.get(key) ?? {
      ids: [],
      days: [],
      start: hhmm(r.start_time),
      end: hhmm(r.end_time),
      staff: r.required_staff_count,
      awake: r.awake_required,
      notes,
    };
    b.ids.push(r.id);
    const add = r.day_of_week == null ? ALL_DAYS : [r.day_of_week];
    b.days = [...new Set([...b.days, ...add])].sort((x, y) => x - y);
    blocks.set(key, b);
  }
  return [...blocks.values()].sort(
    (a, b) => a.start.localeCompare(b.start) || byWeek(a.days[0] ?? 0, b.days[0] ?? 0),
  );
}

/** The day_of_week values to store for a block: one null row for every day. */
export function needDays(days: readonly number[]): (number | null)[] {
  const set = [...new Set(days)].sort((a, b) => a - b);
  return set.length === 7 ? [null] : set;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What's wrong with a block, in plain words; empty when it can be saved. */
export function needProblems(b: NeedBlock): string[] {
  const out: string[] = [];
  if (b.days.length === 0 || b.days.some((d) => !ALL_DAYS.includes(d)))
    out.push("Pick at least one day.");
  if (!TIME.test(b.start) || !TIME.test(b.end)) out.push("Enter a start and end time.");
  else if (b.start === b.end) out.push("The end time must differ from the start time.");
  if (!Number.isInteger(b.staff) || b.staff < 1 || b.staff > MAX_STAFF)
    out.push(`Staff needed is a whole number from 1 to ${MAX_STAFF}.`);
  if (b.notes.length > 500) out.push("Keep the note under 500 characters.");
  return out;
}

/** "Every day", "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri". */
export function daysText(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  const ordered = WEEK_ORDER.filter((d) => set.has(d));
  const runs: number[][] = [];
  for (const d of ordered) {
    const run = runs[runs.length - 1];
    if (run && weekPos(run[run.length - 1]) + 1 === weekPos(d)) run.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) =>
      r.length >= 3
        ? `${DAY_NAMES[r[0]]}–${DAY_NAMES[r[r.length - 1]]}`
        : r.map((d) => DAY_NAMES[d]).join(", "),
    )
    .join(", ");
}

/** "15:00" → "3:00 PM". */
export function timeText(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Mon–Fri · 3:00 PM – 11:00 PM · 2 staff · awake overnight". */
export function blockText(b: NeedBlock): string {
  const overnight = b.end <= b.start ? " (next day)" : "";
  const parts = [
    daysText(b.days),
    `${timeText(b.start)} – ${timeText(b.end)}${overnight}`,
    `${b.staff} staff`,
  ];
  if (b.awake) parts.push("awake overnight");
  return parts.join(" · ");
}
