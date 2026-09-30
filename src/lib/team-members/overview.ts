// Team member Overview — pure math. No I/O.
//
// Every number here comes from one existing rule, imported rather than
// re-stated:
//   Evidence status    → cellStatus / matrixChip / latestFileForItem /
//                        itemHasCompletedEvidence / effectiveAttentionDate
//                        (src/lib/evidence/*), the Team member file's helpers.
//   Timed-shift notes  → reviewExceptions() "missing_note" (records review
//                        queue), skipping historical imports still awaiting
//                        the staff member's confirmation, as the queue does.
//   Host-home notes    → missingDailyLogEntries() (the Daily Logs page's
//                        missing-entries rule, HHS / RP5 clients).
//   Hours              → durationMs(punchPair()) — the Records Duration math.
// A stat the agency has no data source for is null, never 0.

import { addDays, effectiveAttentionDate, parseIsoDate } from "../evidence/due.ts";
import {
  cellStatus,
  daysBetweenIso,
  itemHasCompletedEvidence,
  latestFileForItem,
  matrixChip,
  type EvidenceMatrixChipKind,
} from "../evidence/status.ts";
import type { EvidenceCellStatus, EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";
import { denverYmdFromInstant, weekdaySunday0 } from "../denver-date.ts";
import { durationMs, punchPair } from "../record-duration.ts";
import { reviewExceptions } from "../records-review-rules.ts";
import { missingDailyLogEntries } from "../daily-log-missing.ts";
import { addDaysYmd } from "./profile.ts";

/* -------------------------------- windows -------------------------------- */

/** Evidence on file that renews / expires within this many days needs attention. */
export const EXPIRING_DAYS = 30;
/** Evidence not on file yet that is due within this many days needs attention. */
export const DUE_SOON_DAYS = 14;
/** Look-back for missing notes. */
export const NOTE_LOOKBACK_DAYS = 14;
/** "Coming up" horizon. */
export const COMING_UP_DAYS = 60;
/** Weekly hours above this are overtime. */
export const OVERTIME_THRESHOLD_HOURS = 40;
export const ANNUAL_TRAINING_KEY = "annual_12hr_training";
export const TRAINING_HOURS_NOTE = "Hour tracking comes with the training update";

/* --------------------------------- types --------------------------------- */

export type OverviewTone = "bad" | "warn";

export type AttentionKind =
  | "evidence_missing"
  | "evidence_expiring"
  | "evidence_review"
  | "evidence_sent_back"
  | "evidence_due"
  | "note_missing"
  | "daily_note_missing";

export type AttentionItem = {
  /** Stable React key. */
  key: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  href: string;
  tone: OverviewTone;
  /** YYYY-MM-DD the item is about (due date, shift date); null when none. */
  date: string | null;
};

export type OverviewEvidenceItem = EvidenceItemRow & {
  opted_out_at?: string | null;
  opted_out_by?: string | null;
};

/** evv_timesheets columns the Overview reads. */
export type OverviewTimesheet = {
  id: string;
  client_id: string | null;
  service_type_code: string | null;
  clock_in_timestamp: string;
  clock_out_timestamp: string | null;
  corrected_clock_in?: string | null;
  corrected_clock_out?: string | null;
  review_status?: string | null;
  status?: string | null;
  shift_note_text: string | null;
  goals_completed: unknown;
  import_source: string | null;
  staff_confirmed_at: string | null;
  is_out_of_bounds: boolean | null;
  outside_geofence_reason: string | null;
};

export type OverviewDailyClient = { id: string; name: string };

export type ReadyItem = {
  id: string;
  title: string;
  /** matrixChip kind — the same chip the Team member file draws. */
  status: EvidenceMatrixChipKind;
  label: string;
  /** Next attention date (due / renews / expires), YYYY-MM-DD. */
  date: string | null;
};

export type ReadyToWork = { noPack: boolean; items: ReadyItem[] };

export type WeekDay = { date: string; hours: number };

export type ThisWeek = {
  /** Monday, YYYY-MM-DD (America/Denver). */
  start: string;
  /** Sunday, YYYY-MM-DD. */
  end: string;
  /** Null when the agency has no evv_timesheets rows at all. */
  hours: {
    clocked: number;
    /** Open punches (no clock-out) — excluded from clocked. */
    stillClockedIn: number;
    byDay: WeekDay[];
  } | null;
  /** Null when the agency keeps neither shift notes nor daily logs. */
  notes: { submitted: number; needed: number } | null;
  /** Hours over 40 this week; null when hours is null. */
  overtimeHours: number | null;
  /** One line per null stat, for the card's "—". */
  reasons: { hours: string | null; notes: string | null };
};

export type TrainingStatus = {
  /** Null when the person's pack has no annual training item. */
  item: {
    title: string;
    status: EvidenceMatrixChipKind;
    label: string;
    date: string | null;
  } | null;
  note: string;
};

export type ComingUpItem = { id: string; title: string; date: string; label: string };

export type MemberOverview = {
  today: string;
  attention: AttentionItem[];
  readyToWork: ReadyToWork;
  thisWeek: ThisWeek;
  training: TrainingStatus;
  comingUp: ComingUpItem[];
  /** Team member file menu badge: distinct items missing, expiring or awaiting review. */
  fileBadgeCount: number;
};

/* -------------------------------- evidence ------------------------------- */

type EvidenceRow = {
  item: OverviewEvidenceItem;
  file: EvidenceFileRow | null;
  status: EvidenceCellStatus;
  chip: ReturnType<typeof matrixChip>;
  onFile: boolean;
  /** effectiveAttentionDate — the date the Team member file shows. */
  due: string | null;
};

/** One row per item, through the Team member file's helpers. */
export function evidenceRows(
  items: readonly OverviewEvidenceItem[],
  files: readonly EvidenceFileRow[],
  today: string,
): EvidenceRow[] {
  return items.map((item) => {
    const file = latestFileForItem(files, item.id);
    const onFile = itemHasCompletedEvidence(item, file);
    return {
      item,
      file,
      status: cellStatus({ item, file, today }),
      chip: matrixChip({ item, file, today }),
      onFile,
      due: parseIsoDate(
        effectiveAttentionDate({
          hasFile: onFile,
          firstDueOn: item.first_due_on,
          nextDueOn: item.next_due_on,
          expiresOn: item.expires_on,
        }),
      ),
    };
  });
}

function inDays(n: number): string {
  if (n <= 0) return "today";
  return n === 1 ? "in 1 day" : `in ${n} days`;
}

function agoDays(n: number): string {
  return n === 1 ? "1 day ago" : `${n} days ago`;
}

/**
 * Evidence attention, one entry per item at most:
 *   awaiting review            → "Awaiting review" (warn)
 *   sent back                  → "Sent back" (bad)
 *   on file, past renew date   → "Expired" (bad)
 *   on file, renews ≤ 30 days  → "Expires in N days" (warn)
 *   not on file, past due      → "Overdue" (bad)
 *   not on file, no date       → "Missing" (bad)
 *   not on file, due ≤ 14 days → "Due in N days" (warn)
 * Skipped items never count. Not on file and due later than 14 days is not
 * attention yet — it shows under Coming up.
 */
export function evidenceAttention(
  rows: readonly EvidenceRow[],
  today: string,
  fileHref: string,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of rows) {
    const { item, status, onFile, due } = r;
    if (status === "skipped") continue;
    const base = { key: `ev-${item.id}`, href: fileHref, date: due };
    const days = due ? daysBetweenIso(today, due) : null;
    if (status === "awaiting_review") {
      out.push({
        ...base,
        kind: "evidence_review",
        tone: "warn",
        title: item.title,
        detail: "Upload awaiting review",
      });
    } else if (status === "sent_back") {
      out.push({
        ...base,
        kind: "evidence_sent_back",
        tone: "bad",
        title: item.title,
        detail: "Sent back — waiting on a new upload",
      });
    } else if (onFile) {
      if (days === null) continue;
      if (days < 0) {
        out.push({
          ...base,
          kind: "evidence_missing",
          tone: "bad",
          title: item.title,
          detail: `Expired ${agoDays(-days)}`,
        });
      } else if (days <= EXPIRING_DAYS) {
        out.push({
          ...base,
          kind: "evidence_expiring",
          tone: "warn",
          title: item.title,
          detail: `Expires ${inDays(days)}`,
        });
      }
    } else if (days === null) {
      out.push({
        ...base,
        kind: "evidence_missing",
        tone: "bad",
        title: item.title,
        detail: item.sent_to_staff ? "Missing — sent to the team member" : "Missing",
      });
    } else if (days < 0) {
      out.push({
        ...base,
        kind: "evidence_missing",
        tone: "bad",
        title: item.title,
        detail: `Overdue — was due ${agoDays(-days)}`,
      });
    } else if (days <= DUE_SOON_DAYS) {
      out.push({
        ...base,
        kind: "evidence_due",
        tone: "warn",
        title: item.title,
        detail: `Due ${inDays(days)}`,
      });
    }
  }
  return out;
}

/**
 * Team member file menu badge — the roster's own counts (summarizeEvidence):
 * missing (cellStatus missing / sent back) + awaiting review + due soon
 * (attention date within 30 days), counted once per item. Skipped never counts.
 */
export function fileBadgeCount(rows: readonly EvidenceRow[], today: string): number {
  const soonEnd = addDays(today, EXPIRING_DAYS) ?? today;
  let n = 0;
  for (const r of rows) {
    if (r.status === "skipped") continue;
    const dueSoon = !!r.due && r.due >= today && r.due <= soonEnd;
    if (r.status !== "done" || dueSoon) n += 1;
  }
  return n;
}

export function readyToWork(rows: readonly EvidenceRow[]): ReadyToWork {
  return {
    noPack: rows.length === 0,
    items: rows
      .map((r) => ({
        id: r.item.id,
        title: r.item.title,
        status: r.chip.kind,
        label: r.chip.label,
        date: r.due,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export function trainingStatus(rows: readonly EvidenceRow[]): TrainingStatus {
  const r = rows.find((x) => x.item.requirement_key === ANNUAL_TRAINING_KEY);
  return {
    item: r ? { title: r.item.title, status: r.chip.kind, label: r.chip.label, date: r.due } : null,
    note: TRAINING_HOURS_NOTE,
  };
}

/** Evidence due / renewal dates from today through today + 60 days, soonest first. */
export function comingUp(rows: readonly EvidenceRow[], today: string): ComingUpItem[] {
  const end = addDaysYmd(today, COMING_UP_DAYS);
  return rows
    .filter((r) => r.status !== "skipped" && !!r.due && r.due >= today && r.due <= end)
    .map((r) => ({
      id: r.item.id,
      title: r.item.title,
      date: r.due!,
      label: r.onFile ? "Renews" : "Due",
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/* ---------------------------------- time --------------------------------- */

/** Monday–Sunday week (America/Denver calendar) containing today. */
export function denverWeek(today: string): { start: string; end: string; days: string[] } {
  const offset = (weekdaySunday0(today) + 6) % 7;
  const start = addDaysYmd(today, -offset);
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  return { start, end: days[6]!, days };
}

/** Denver calendar date a punch belongs to (its clock-in, corrected when approved). */
export function punchDay(t: OverviewTimesheet): string | null {
  return denverYmdFromInstant(punchPair(t).in ?? null);
}

function isOpen(t: OverviewTimesheet): boolean {
  return !punchPair(t).out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function goalsList(v: unknown): string[] | null {
  return Array.isArray(v) ? v.map(String) : null;
}

/**
 * The review queue's note verdict for one timesheet: its "missing_note" label
 * ("Missing/short note" / "PCSP goal not checked"), or null when the note is
 * fine. Open punches and historical imports still awaiting the staff member's
 * confirmation aren't judged, same as the queue.
 */
export function timesheetNoteProblem(t: OverviewTimesheet, now: Date): string | null {
  if (!t.clock_out_timestamp) return null;
  if (t.import_source === "historical_import" && t.status === "Pending_Staff_Confirmation") {
    return null;
  }
  const exc = reviewExceptions(
    {
      is_out_of_bounds: t.is_out_of_bounds,
      outside_geofence_reason: t.outside_geofence_reason,
      shift_note_text: t.shift_note_text,
      goals_completed: goalsList(t.goals_completed),
      clock_in_timestamp: t.clock_in_timestamp,
      clock_out_timestamp: t.clock_out_timestamp,
      service_type_code: t.service_type_code ?? "",
      import_source: t.import_source,
      staff_confirmed_at: t.staff_confirmed_at,
    },
    now,
  ).find((e) => e.code === "missing_note");
  return exc?.label ?? null;
}

/** Closed timesheets that need a note (the review queue judges them). */
function judgedTimesheets(timesheets: readonly OverviewTimesheet[]): OverviewTimesheet[] {
  return timesheets.filter(
    (t) =>
      !!t.clock_out_timestamp &&
      !(t.import_source === "historical_import" && t.status === "Pending_Staff_Confirmation"),
  );
}

export type NoteInputs = {
  timesheets: readonly OverviewTimesheet[];
  /** HHS / RP5 clients on the person's caseload (dailyLogProgram). */
  dailyClients: readonly OverviewDailyClient[];
  /** The person's daily_logs rows, status <> 'rejected'. */
  dailyLogs: readonly { client_id: string; log_date: string }[];
  clientNames: Readonly<Record<string, string>>;
};

/** Past dates (yesterday back) — the Daily Logs page never asks for today yet. */
function pastDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysYmd(today, -(i + 1)));
}

/** Missing notes in the last 14 days: one per timed shift, one per daily-note client. */
export function noteAttention(args: NoteInputs & { today: string; now: Date }): AttentionItem[] {
  const since = addDaysYmd(args.today, -NOTE_LOOKBACK_DAYS);
  const out: AttentionItem[] = [];
  for (const t of args.timesheets) {
    const day = punchDay(t);
    if (!day || day < since || day > args.today) continue;
    const problem = timesheetNoteProblem(t, args.now);
    if (!problem) continue;
    const client = (t.client_id && args.clientNames[t.client_id]) || "Client";
    out.push({
      key: `ts-${t.id}`,
      kind: "note_missing",
      tone: "bad",
      title: `${problem} — ${client}`,
      detail: `${t.service_type_code ?? "Shift"} shift on ${day}`,
      href: "/dashboard/hub/documentation?tab=records",
      date: day,
    });
  }
  const missing = missingDailyLogEntries({
    clients: args.dailyClients,
    dates: pastDays(args.today, NOTE_LOOKBACK_DAYS),
    submitted: args.dailyLogs,
  });
  const byClient = new Map<string, { client: OverviewDailyClient; dates: string[] }>();
  for (const m of missing) {
    const g = byClient.get(m.client.id) ?? { client: m.client, dates: [] };
    g.dates.push(m.date);
    byClient.set(m.client.id, g);
  }
  for (const { client, dates } of byClient.values()) {
    dates.sort();
    const latest = dates[dates.length - 1]!;
    out.push({
      key: `dl-${client.id}`,
      kind: "daily_note_missing",
      tone: "bad",
      title: `${dates.length} daily note${dates.length === 1 ? "" : "s"} missing — ${client.name}`,
      detail: `Last ${NOTE_LOOKBACK_DAYS} days · most recent ${latest}`,
      href: "/dashboard/daily-logs",
      date: latest,
    });
  }
  return out;
}

/**
 * This week (Mon–Sun, Denver):
 *   hours       closed punches whose clock-in falls in the week (Records math);
 *               open punches counted apart as "still clocked in".
 *   notes       needed = closed timed shifts this week + daily-note client-days
 *               this week before today; submitted = the ones with a note.
 *   overtime    hours over 40.
 */
export function thisWeek(
  args: NoteInputs & {
    today: string;
    now: Date;
    /** False when the agency has no evv_timesheets rows at all. */
    usesTimesheets: boolean;
    /** False when the agency has no evv_timesheets and no daily_logs rows. */
    usesNotes: boolean;
  },
): ThisWeek {
  const week = denverWeek(args.today);
  const inWeek = (d: string | null) => !!d && d >= week.start && d <= week.end;

  let hours: ThisWeek["hours"] = null;
  if (args.usesTimesheets) {
    const byDay = new Map(week.days.map((d) => [d, 0]));
    let stillClockedIn = 0;
    for (const t of args.timesheets) {
      if (isOpen(t)) {
        stillClockedIn += 1;
        continue;
      }
      const day = punchDay(t);
      if (!inWeek(day)) continue;
      const pair = punchPair(t);
      byDay.set(day!, (byDay.get(day!) ?? 0) + durationMs(pair.in, pair.out) / 3_600_000);
    }
    const days = week.days.map((d) => ({ date: d, hours: round2(byDay.get(d) ?? 0) }));
    hours = {
      clocked: round2([...byDay.values()].reduce((a, b) => a + b, 0)),
      stillClockedIn,
      byDay: days,
    };
  }

  let notes: ThisWeek["notes"] = null;
  if (args.usesNotes) {
    const timed = judgedTimesheets(args.timesheets).filter((t) => inWeek(punchDay(t)));
    const timedMissing = timed.filter((t) => timesheetNoteProblem(t, args.now) !== null).length;
    const dates = week.days.filter((d) => d < args.today);
    const dailyNeeded = args.dailyClients.length * dates.length;
    const dailyMissing = missingDailyLogEntries({
      clients: args.dailyClients,
      dates,
      submitted: args.dailyLogs,
    }).length;
    const needed = timed.length + dailyNeeded;
    notes = { needed, submitted: needed - timedMissing - dailyMissing };
  }

  return {
    start: week.start,
    end: week.end,
    hours,
    notes,
    overtimeHours: hours ? round2(Math.max(0, hours.clocked - OVERTIME_THRESHOLD_HOURS)) : null,
    reasons: {
      hours: hours ? null : "This agency doesn't clock shifts in HIVE yet.",
      notes: notes ? null : "This agency doesn't keep shift notes or daily logs in HIVE yet.",
    },
  };
}

/* --------------------------------- whole --------------------------------- */

const TONE_RANK: Record<OverviewTone, number> = { bad: 0, warn: 1 };

export function buildMemberOverview(
  args: NoteInputs & {
    staffId: string;
    today: string;
    now: Date;
    items: readonly OverviewEvidenceItem[];
    files: readonly EvidenceFileRow[];
    usesTimesheets: boolean;
    usesNotes: boolean;
  },
): MemberOverview {
  const rows = evidenceRows(args.items, args.files, args.today);
  const fileHref = `/dashboard/team-members/${args.staffId}?tab=file`;
  const attention = [...evidenceAttention(rows, args.today, fileHref), ...noteAttention(args)].sort(
    (a, b) =>
      TONE_RANK[a.tone] - TONE_RANK[b.tone] ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
  return {
    today: args.today,
    attention,
    readyToWork: readyToWork(rows),
    thisWeek: thisWeek(args),
    training: trainingStatus(rows),
    comingUp: comingUp(rows, args.today),
    fileBadgeCount: fileBadgeCount(rows, args.today),
  };
}
