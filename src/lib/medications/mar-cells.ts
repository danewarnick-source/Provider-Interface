// MAR cell rules: the types the grid uses, what a logged dose shows as,
// late entries (documented more than 60 minutes after the dose), paused
// windows from the change history, the summary line and the printed cell
// code. Pure; shared by mar-grid.ts, the MAR tab and the PDF.

import type { DisplayMed } from "./med-display.ts";
import { isTakenStatus } from "./dose-status.ts";

export type MarMed = DisplayMed & {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
};

export interface MarChange {
  medication_id: string;
  action: string;
  changed_at: string;
}

export interface MarLog {
  id: string;
  medication_id: string | null;
  scheduled_for: string;
  status: string;
  actual_taken_at?: string | null;
  administered_at?: string | null;
  documented_at?: string | null;
  created_at?: string | null;
  staff_id?: string | null;
  exception_reason?: string | null;
  is_medication_error?: boolean | null;
  prn_followup_due_at?: string | null;
  prn_followup_at?: string | null;
}

export type CellKind = "given" | "refused" | "missed" | "held" | "away" | "not_due" | "upcoming";

export interface MarCell {
  day: string;
  kind: CellKind;
  logId: string | null;
  /** "8:04a" when given. */
  time: string;
  initials: string;
  late: boolean;
  error: boolean;
}

export interface MarRow {
  key: string;
  medId: string;
  /** "08:00", or null for a PRN row. */
  time: string | null;
  /** True for a time that is no longer on the medication (doses logged earlier). */
  oldTime: boolean;
  cells: MarCell[];
  /** PRN rows: doses per day. */
  prnCounts: number[];
  prnLogIds: string[][];
}

export interface MarSummary {
  given: number;
  due: number;
  refused: number;
  missed: number;
  held: number;
  prnGiven: number;
  prnFollowupsMissing: number;
  errors: number;
  lateEntries: number;
}

const LATE_MINUTES = 60;
const AWAY = /not (at )?home|\bloa\b|away|leave of absence/i;

/** Documented more than 60 minutes after the dose was taken. */
export function isLateEntry(log: MarLog): boolean {
  const taken = Date.parse(log.actual_taken_at ?? log.administered_at ?? "");
  const documented = Date.parse(log.documented_at ?? log.created_at ?? "");
  if (!Number.isFinite(taken) || !Number.isFinite(documented)) return false;
  return documented - taken > LATE_MINUTES * 60_000;
}

/** What a logged status shows as in the grid. */
export function logKind(log: Pick<MarLog, "status" | "exception_reason">): CellKind {
  const s = String(log.status ?? "").toLowerCase();
  if (isTakenStatus(s)) return "given";
  if (s === "refused") return "refused";
  if (s === "missed") return "missed";
  if (s === "loa" || AWAY.test(log.exception_reason ?? "")) return "away";
  return "held";
}

/** Paused windows [from, to) from the change history plus a current pause. */
export function pausedWindows(med: MarMed, changes: readonly MarChange[]): Array<[number, number]> {
  const events = changes
    .filter((c) => c.medication_id === med.id && (c.action === "pause" || c.action === "resume"))
    .map((c) => ({ action: c.action, at: Date.parse(c.changed_at) }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
  const out: Array<[number, number]> = [];
  let open: number | null = null;
  for (const e of events) {
    if (e.action === "pause" && open == null) open = e.at;
    if (e.action === "resume" && open != null) {
      out.push([open, e.at]);
      open = null;
    }
  }
  const current = Date.parse(med.paused_at ?? "");
  if (open == null && Number.isFinite(current)) open = current;
  if (open != null) out.push([open, Number.POSITIVE_INFINITY]);
  return out;
}

/** "28 of 30 doses given · 1 refused · 1 missed · 3 PRNs · …" */
export function summaryLine(s: MarSummary): string {
  const parts = [
    `${s.given} of ${s.due} doses given`,
    `${s.refused} refused`,
    `${s.missed} missed`,
  ];
  if (s.held) parts.push(`${s.held} held`);
  parts.push(`${s.prnGiven} PRN${s.prnGiven === 1 ? "" : "s"} given`);
  parts.push(
    `${s.prnFollowupsMissing} PRN follow-up${s.prnFollowupsMissing === 1 ? "" : "s"} missing`,
  );
  parts.push(`${s.errors} error${s.errors === 1 ? "" : "s"}`);
  parts.push(`${s.lateEntries} late entr${s.lateEntries === 1 ? "y" : "ies"}`);
  return parts.join(" · ");
}

/** The short code a cell prints as ("TJ 8:04a", "R", "M", "H", "NA"). */
export function cellCode(c: MarCell): string {
  switch (c.kind) {
    case "given":
      return [c.initials, c.time].filter(Boolean).join(" ") || "Given";
    case "refused":
      return "R";
    case "missed":
      return "M";
    case "held":
      return "H";
    case "away":
      return "NA";
    default:
      return "";
  }
}
