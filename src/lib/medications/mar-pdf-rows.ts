// The rows each MAR PDF page prints, built from getMarMonth's data: the
// medication list and its changes, the signature key, the PRN log,
// exceptions (refused, missed, held, errors, late entries, corrections) and
// controlled counts. Pure; mar-pdf.ts draws them and the tests read them.

import { denverYmdFromInstant } from "../denver-date.ts";
import { formatTime12, nameWithStrength, whenGivenLabel } from "./med-display.ts";
import { prnRule, type MedListMed } from "./med-list-pdf.ts";
import { isLateEntry, type MarCell } from "./mar-cells.ts";
import { isTakenStatus } from "./dose-status.ts";
import { longDateTime, shortTime } from "./mar-month.ts";
import type { MarDose, MarMonthData } from "./mar-data.ts";

export type PdfRow = string[];

/** "Sep 5" for a YYYY-MM-DD day. */
export function dayLabel(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const doseDay = (d: Pick<MarDose, "scheduled_for" | "actual_taken_at">) =>
  dayLabel(denverYmdFromInstant(d.actual_taken_at ?? d.scheduled_for));

function medName(data: MarMonthData, id: string | null | undefined): string {
  const m = data.meds.find((x) => x.id === id);
  return m ? nameWithStrength(m) : "Unknown medication";
}

const staffName = (data: MarMonthData, id: string | null | undefined, fallback?: string | null) =>
  data.staff.find((s) => s.id === id)?.full_name || fallback || "Unknown";

const ACTION_LABEL: Record<string, string> = {
  add: "Added",
  edit: "Changed",
  pause: "Paused",
  resume: "Resumed",
  stop: "Stopped",
  send: "Sent with client",
};

const STATUS_LABEL: Record<string, string> = {
  given: "Given",
  refused: "Refused",
  missed: "Missed",
  held: "Held",
  away: "Not at home",
};

const EFFECT_LABEL: Record<string, string> = {
  helped: "Helped",
  partly: "Partly",
  no: "Didn't help",
};

export function psychControlledFlags(m: MedListMed & Record<string, unknown>): string {
  const flags: string[] = [];
  if (m.is_psychotropic)
    flags.push(`Psychotropic${m.psychotropic_type ? ` (${String(m.psychotropic_type)})` : ""}`);
  if (m.is_controlled)
    flags.push(m.controlled_schedule ? `Controlled C-${m.controlled_schedule}` : "Controlled");
  if (m.is_rescue) flags.push("Rescue");
  return flags.join(", ");
}

/** Name, strength, dose, route, times, for, prescriber, start, stop, PRN rules, flags. */
export function medicationListRows(data: MarMonthData): PdfRow[] {
  return data.grid.meds.map((raw) => {
    const m = raw as unknown as MedListMed & Record<string, unknown>;
    const stop =
      (m.end_date as string | null)?.slice(0, 10) ||
      denverYmdFromInstant((m.discontinued_at as string | null) ?? null) ||
      "";
    return [
      nameWithStrength(m),
      String(m.dosage ?? ""),
      String(m.route ?? ""),
      whenGivenLabel(m),
      String(m.purpose ?? ""),
      String(m.prescriber ?? ""),
      dayLabel((m.start_date as string | null)?.slice(0, 10)),
      dayLabel(stop),
      prnRule(m) ?? "",
      psychControlledFlags(m),
    ];
  });
}

function changeDetail(c: MarMonthData["changes"][number]): string {
  const fields = Object.keys(c.changes ?? {}).filter(
    (k) =>
      !["paused_at", "pause_reason", "discontinued_at", "discontinued_by", "is_active"].includes(k),
  );
  const parts: string[] = [];
  if (c.action === "edit" && fields.length)
    parts.push(fields.map((f) => f.replace(/_/g, " ")).join(", "));
  if (c.action === "send") {
    const to = c.changes?.sent_to?.to;
    const qty = c.changes?.quantity?.to;
    parts.push(`${qty ?? "?"} to ${to ?? "?"}`);
  }
  if (c.reason) parts.push(c.reason);
  return parts.join(" - ");
}

/** Date, medication, what happened, details, by. */
export function changeRows(data: MarMonthData): PdfRow[] {
  return data.changes.map((c) => [
    dayLabel(denverYmdFromInstant(c.changed_at)),
    medName(data, c.medication_id),
    ACTION_LABEL[c.action] ?? c.action,
    changeDetail(c),
    (c.changed_by && data.names[c.changed_by]) || "",
  ]);
}

/** Initials, full name, title. */
export function signatureRows(data: MarMonthData): PdfRow[] {
  return data.staff.map((s) => [s.initials, s.full_name ?? "Unknown", s.title ?? ""]);
}

/** Date, time, med, dose, reason, tried first, helped, follow-up, staff. */
export function prnRows(data: MarMonthData): PdfRow[] {
  return data.doses
    .filter((d) => d.is_prn && isTakenStatus(d.status))
    .map((d) => {
      const med = data.meds.find((m) => m.id === d.medication_id) as
        | (MedListMed & { dosage?: string | null })
        | undefined;
      const followup = d.prn_followup_at
        ? shortTime(d.prn_followup_at)
        : d.prn_followup_due_at
          ? `Not checked (due ${shortTime(d.prn_followup_due_at)})`
          : "";
      return [
        doseDay(d),
        shortTime(d.actual_taken_at ?? d.administered_at),
        medName(data, d.medication_id),
        med?.dosage ?? med?.strength ?? "",
        d.prn_reason ?? "",
        d.prn_tried_first ?? "",
        EFFECT_LABEL[d.prn_effect ?? ""] ?? "",
        followup,
        staffName(data, d.staff_id, d.staff_name),
      ];
    });
}

const cellReason = (data: MarMonthData, c: MarCell): string => {
  if (!c.logId) return c.kind === "held" ? "Medication paused" : "No dose logged";
  return data.doses.find((d) => d.id === c.logId)?.exception_reason ?? "";
};

/** Each exception: [date, time, medication, what, details]. */
export function exceptionRows(data: MarMonthData): PdfRow[] {
  const out: PdfRow[] = [];
  for (const row of data.grid.rows) {
    for (const c of row.cells) {
      if (!["refused", "missed", "held", "away"].includes(c.kind)) continue;
      out.push([
        dayLabel(c.day),
        row.time ? formatTime12(row.time) : "",
        medName(data, row.medId),
        STATUS_LABEL[c.kind],
        cellReason(data, c),
      ]);
    }
  }
  for (const d of data.doses) {
    if (d.is_medication_error) {
      const incident = data.incidents[d.id];
      out.push([
        doseDay(d),
        shortTime(d.scheduled_for),
        medName(data, d.medication_id),
        "Medication error",
        [d.error_description ?? "", incident ? `Incident ${incident}` : "No incident linked"]
          .filter(Boolean)
          .join(" - "),
      ]);
    }
    if (isLateEntry(d)) {
      out.push([
        doseDay(d),
        shortTime(d.actual_taken_at ?? d.administered_at),
        medName(data, d.medication_id),
        "Late entry",
        `Taken ${longDateTime(d.actual_taken_at ?? d.administered_at)}, documented ${longDateTime(d.documented_at ?? d.created_at)}`,
      ]);
    }
  }
  for (const a of data.addenda) {
    const d = data.doses.find((x) => x.id === a.emar_log_id);
    if (!d) continue;
    const original = `${STATUS_LABEL[isTakenStatus(d.status) ? "given" : d.status] ?? d.status} ${shortTime(d.actual_taken_at ?? d.scheduled_for)} by ${staffName(data, d.staff_id, d.staff_name)}`;
    out.push([
      doseDay(d),
      shortTime(d.scheduled_for),
      medName(data, d.medication_id),
      "Correction",
      `Original: ${original}. Correction: ${a.note}${a.reason ? ` (Reason: ${a.reason})` : ""} - ${a.staff_name ?? "Staff"}, ${longDateTime(a.created_at)}`,
    ]);
  }
  return out;
}

/** Date, med, when, expected, counted, difference, staff. */
export function countRows(data: MarMonthData): PdfRow[] {
  return data.counts.map((c) => {
    const diff =
      c.variance ?? (c.expected_count != null ? c.counted_value - c.expected_count : null);
    return [
      dayLabel(denverYmdFromInstant(c.created_at)),
      medName(data, c.medication_id),
      c.context,
      c.expected_count == null ? "" : String(c.expected_count),
      String(c.counted_value),
      diff == null ? "" : `${diff > 0 ? "+" : ""}${diff}${c.flagged ? " (flagged)" : ""}`,
      c.staff_name ?? staffName(data, c.staff_id),
    ];
  });
}
