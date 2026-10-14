// The MAR grid for one client and month: which medications show, the
// expected doses per day (held while paused, not due before the start or
// after the stop), what was logged, and the month summary. Pure; the data
// comes from getMarMonth (mar.functions.ts) and feeds the MAR tab and PDF.

import { denverMonthUtcBounds, denverWallToIso, denverYmdFromInstant } from "../denver-date.ts";
import { sortMedications, sortedTimes } from "./med-display.ts";
import { isTakenStatus } from "./dose-status.ts";
import { isLateDose } from "./give-meds.ts";
import { monthDays, monthEnd, monthStart, shortTime } from "./mar-month.ts";
import {
  isLateEntry,
  logKind,
  pausedWindows,
  type CellKind,
  type MarCell,
  type MarChange,
  type MarLog,
  type MarMed,
  type MarRow,
  type MarSummary,
} from "./mar-cells.ts";

const startDay = (m: MarMed) =>
  (m.start_date ?? "").slice(0, 10) || denverYmdFromInstant(m.created_at ?? null) || "";

/** Medications active at any point in the month, or with a dose logged in it. */
export function marMedications<T extends MarMed>(
  meds: readonly T[],
  month: string,
  logs: readonly MarLog[] = [],
): T[] {
  const first = monthStart(month);
  const last = monthEnd(month);
  const logged = new Set(logs.map((l) => l.medication_id));
  return sortMedications(
    meds.filter((m) => {
      if (logged.has(m.id)) return true;
      const start = startDay(m);
      if (start && start > last) return false;
      if (m.end_date && m.end_date.slice(0, 10) < first) return false;
      const stopped = denverYmdFromInstant(m.discontinued_at ?? null);
      if (stopped && stopped < first) return false;
      if (m.is_active === false && !stopped) return false;
      return true;
    }),
  );
}

/** "HH:MM" of an instant in Denver time. */
function denverHm(iso: string): string {
  const ms = Date.parse(iso);
  return new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: "America/Denver",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function expectedKind(
  med: MarMed,
  day: string,
  at: number,
  paused: Array<[number, number]>,
  now: number,
): CellKind {
  const start = startDay(med);
  if (start && day < start) return "not_due";
  if (med.end_date && day > med.end_date.slice(0, 10)) return "not_due";
  const stopped = Date.parse(med.discontinued_at ?? "");
  if (Number.isFinite(stopped) && at >= stopped) return "not_due";
  if (paused.some(([a, b]) => at >= a && at < b)) return "held";
  return at < now ? "missed" : "upcoming";
}

export interface MarGridInput {
  month: string;
  meds: readonly MarMed[];
  changes: readonly MarChange[];
  logs: readonly MarLog[];
  initials: ReadonlyMap<string, string>;
  now?: Date;
}

export interface MarGrid {
  days: string[];
  meds: MarMed[];
  rows: MarRow[];
  summary: MarSummary;
}

export function buildMarGrid(input: MarGridInput): MarGrid {
  const now = (input.now ?? new Date()).getTime();
  const days = monthDays(input.month);
  const p = /^(\d{4})-(\d{2})/.exec(input.month);
  const bounds = denverMonthUtcBounds(Number(p?.[1]), Number(p?.[2]));
  const from = Date.parse(bounds.startIso);
  const to = Date.parse(bounds.endExclusiveIso);
  const logs = input.logs.filter((l) => {
    const at = Date.parse(l.scheduled_for);
    return at >= from && at < to;
  });
  const meds = marMedications(input.meds, input.month, logs);
  const summary: MarSummary = {
    given: 0,
    due: 0,
    refused: 0,
    missed: 0,
    held: 0,
    prnGiven: 0,
    prnFollowupsMissing: 0,
    errors: 0,
    lateEntries: 0,
  };
  for (const l of logs) {
    if (l.is_medication_error) summary.errors += 1;
    if (isLateEntry(l)) summary.lateEntries += 1;
  }
  const rows: MarRow[] = [];
  const blankCell = (day: string, kind: CellKind): MarCell => ({
    day,
    kind,
    logId: null,
    time: "",
    initials: "",
    late: false,
    error: false,
    untrained: false,
  });

  for (const med of meds) {
    const medLogs = logs
      .filter((l) => l.medication_id === med.id)
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    if (med.is_prn) {
      const counts = days.map(() => 0);
      const ids: string[][] = days.map(() => []);
      for (const l of medLogs) {
        if (!isTakenStatus(l.status)) continue;
        const i = days.indexOf(denverYmdFromInstant(l.actual_taken_at ?? l.scheduled_for) ?? "");
        if (i < 0) continue;
        counts[i] += 1;
        ids[i].push(l.id);
        summary.prnGiven += 1;
        const due = Date.parse(l.prn_followup_due_at ?? "");
        if (Number.isFinite(due) && due < now && !l.prn_followup_at)
          summary.prnFollowupsMissing += 1;
      }
      rows.push({
        key: `${med.id}:prn`,
        medId: med.id,
        time: null,
        oldTime: false,
        cells: [],
        prnCounts: counts,
        prnLogIds: ids,
      });
      continue;
    }
    const current = sortedTimes(med.scheduled_times);
    const byKey = new Map<string, MarLog>();
    const extraTimes = new Set<string>();
    for (const l of medLogs) {
      const key = `${denverYmdFromInstant(l.scheduled_for)}|${denverHm(l.scheduled_for)}`;
      if (!byKey.has(key)) byKey.set(key, l);
      const hm = denverHm(l.scheduled_for);
      if (!current.includes(hm)) extraTimes.add(hm);
    }
    const paused = pausedWindows(med, input.changes);
    const times = [...current, ...[...extraTimes].sort()];
    for (const time of times) {
      const oldTime = !current.includes(time);
      const [h, m] = time.split(":").map(Number);
      const cells = days.map((day) => {
        const log = byKey.get(`${day}|${time}`);
        if (!log) {
          if (oldTime) return blankCell(day, "not_due");
          return blankCell(
            day,
            expectedKind(med, day, Date.parse(denverWallToIso(day, h, m)), paused, now),
          );
        }
        const kind = logKind(log);
        return {
          day,
          kind,
          logId: log.id,
          time: kind === "given" ? shortTime(log.actual_taken_at ?? log.administered_at) : "",
          initials: input.initials.get(log.staff_id ?? "") ?? "",
          late: isLateEntry(log) || isLateDose(log),
          error: !!log.is_medication_error,
          untrained: !!log.given_without_current_training,
        };
      });
      for (const c of cells) {
        if (c.kind === "given") summary.given += 1;
        if (c.kind === "refused") summary.refused += 1;
        if (c.kind === "missed") summary.missed += 1;
        if (c.kind === "held") summary.held += 1;
        if (["given", "refused", "missed", "away"].includes(c.kind)) summary.due += 1;
      }
      rows.push({
        key: `${med.id}:${time}`,
        medId: med.id,
        time,
        oldTime,
        cells,
        prnCounts: [],
        prnLogIds: [],
      });
    }
  }
  return { days, meds, rows, summary };
}
