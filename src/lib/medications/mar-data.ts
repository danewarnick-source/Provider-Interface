// Loads one client's MAR month behind mar.functions.ts: medications, change
// history, doses, corrections, controlled counts, linked incidents, the staff
// who charted, and the month's sign-off. Callers run assertCanManageClient
// first and pass the service client. Two queries for people (profiles, then
// organization_members), joined here; never embedded.

import { denverMonthUtcBounds } from "../denver-date.ts";
import type { Sb } from "./meds-write.ts";
import { buildMarGrid, type MarGrid } from "./mar-grid.ts";
import { monthStart, parseMonth, staffInitials, type MarPerson } from "./mar-month.ts";
import type { MarChange, MarLog, MarMed } from "./mar-cells.ts";

export const MAR_LOG_COLUMNS =
  "id, medication_id, scheduled_for, status, actual_taken_at, administered_at, documented_at, created_at, staff_id, staff_name, route, is_prn, prn_reason, prn_effect, prn_followup_due_at, prn_followup_at, prn_tried_first, prescriber_notified, notes, exception_reason, is_medication_error, error_description, pill_count_value";

export type MarDose = MarLog & {
  staff_name?: string | null;
  route?: string | null;
  is_prn?: boolean | null;
  prn_reason?: string | null;
  prn_effect?: string | null;
  prn_tried_first?: string | null;
  prescriber_notified?: boolean | null;
  notes?: string | null;
  error_description?: string | null;
  pill_count_value?: number | null;
};

export interface MarAddendum {
  id: string;
  emar_log_id: string;
  note: string;
  reason: string | null;
  staff_id: string;
  staff_name: string | null;
  created_at: string;
}

export interface MarCount {
  id: string;
  medication_id: string;
  emar_log_id: string | null;
  context: string;
  expected_count: number | null;
  counted_value: number;
  variance: number | null;
  flagged: boolean;
  staff_id: string;
  staff_name: string | null;
  created_at: string;
}

/** A JSON value (what client_medication_changes.changes holds). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type MarMonthChange = MarChange & {
  id: string;
  changed_by: string | null;
  changes: Record<string, { from: JsonValue; to: JsonValue }>;
  reason: string | null;
};

export interface MarReview {
  id: string;
  month: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string;
  notes: string | null;
  pdf_path: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}

export type MarStaff = MarPerson & { initials: string };

export interface MarMonthData {
  month: string;
  meds: MarMed[];
  changes: MarMonthChange[];
  doses: MarDose[];
  addenda: MarAddendum[];
  counts: MarCount[];
  /** emar_log_id → incident report number. */
  incidents: Record<string, string>;
  staff: MarStaff[];
  /** Everyone named on the page (charting staff, change authors, reviewer): id → name. */
  names: Record<string, string>;
  review: (MarReview & { reviewed_by_name: string | null }) | null;
  grid: MarGrid;
}

async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Names (profiles) and titles (organization_members), joined in JS. */
export async function loadPeople(sb: Sb, orgId: string, ids: string[]): Promise<MarPerson[]> {
  if (!ids.length) return [];
  const [profiles, members] = await Promise.all([
    rows<{ id: string; full_name: string | null }>(
      sb.from("profiles").select("id, full_name").in("id", ids),
    ),
    rows<{ user_id: string; job_title: string | null }>(
      sb
        .from("organization_members")
        .select("user_id, job_title")
        .eq("organization_id", orgId)
        .in("user_id", ids),
    ),
  ]);
  const titles = new Map(members.map((m) => [m.user_id, m.job_title]));
  const names = new Map(profiles.map((p) => [p.id, p.full_name]));
  return ids.map((id) => ({ id, full_name: names.get(id) ?? null, title: titles.get(id) ?? null }));
}

export async function loadMarMonth(
  sb: Sb,
  a: { orgId: string; clientId: string; month: string; now?: Date },
): Promise<MarMonthData> {
  const p = parseMonth(a.month);
  if (!p) throw new Error("Pick a month.");
  const month = `${p.year}-${String(p.month).padStart(2, "0")}`;
  const { startIso, endExclusiveIso } = denverMonthUtcBounds(p.year, p.month);
  const [meds, allChanges, doses, counts, reviews] = await Promise.all([
    rows<MarMed>(sb.from("client_medications").select("*").eq("client_id", a.clientId)),
    rows<MarMonthChange>(
      sb
        .from("client_medication_changes")
        .select("id, medication_id, action, changed_at, changed_by, changes, reason")
        .eq("client_id", a.clientId)
        .lt("changed_at", endExclusiveIso)
        .order("changed_at", { ascending: true }),
    ),
    rows<MarDose>(
      sb
        .from("emar_logs")
        .select(MAR_LOG_COLUMNS)
        .eq("client_id", a.clientId)
        .gte("scheduled_for", startIso)
        .lt("scheduled_for", endExclusiveIso)
        .order("scheduled_for", { ascending: true }),
    ),
    rows<MarCount>(
      sb
        .from("controlled_med_counts")
        .select(
          "id, medication_id, emar_log_id, context, expected_count, counted_value, variance, flagged, staff_id, staff_name, created_at",
        )
        .eq("client_id", a.clientId)
        .gte("created_at", startIso)
        .lt("created_at", endExclusiveIso)
        .order("created_at", { ascending: true }),
    ),
    rows<MarReview>(
      sb
        .from("medication_month_reviews")
        .select(
          "id, month, status, reviewed_by, reviewed_at, notes, pdf_path, reopened_at, reopen_reason",
        )
        .eq("client_id", a.clientId)
        .eq("month", monthStart(month)),
    ),
  ]);
  const logIds = doses.map((d) => d.id);
  const [addenda, incidents] = logIds.length
    ? await Promise.all([
        rows<MarAddendum>(
          sb
            .from("emar_log_addenda")
            .select("id, emar_log_id, note, reason, staff_id, staff_name, created_at")
            .in("emar_log_id", logIds)
            .order("created_at", { ascending: true }),
        ),
        rows<{ emar_log_id: string; report_number: string | null; id: string }>(
          sb
            .from("incident_reports")
            .select("id, emar_log_id, report_number")
            .eq("organization_id", a.orgId)
            .in("emar_log_id", logIds),
        ),
      ])
    : [[], []];
  const review = reviews[0] ?? null;
  const staffIds = [
    ...new Set(
      [
        ...doses.map((d) => d.staff_id),
        ...allChanges.map((c) => c.changed_by),
        review?.reviewed_by,
      ].filter((v): v is string => !!v),
    ),
  ];
  const people = await loadPeople(sb, a.orgId, staffIds);
  const doseStaff = new Set(doses.map((d) => d.staff_id));
  const charting = people.filter((x) => doseStaff.has(x.id));
  const initials = staffInitials(charting);
  const staff = charting
    .map((x) => ({ ...x, initials: initials.get(x.id) ?? "?" }))
    .sort((x, y) => x.initials.localeCompare(y.initials));
  const from = Date.parse(startIso);
  const changes = allChanges.filter((c) => Date.parse(c.changed_at) >= from);
  return {
    month,
    meds,
    changes,
    doses,
    addenda,
    counts,
    incidents: Object.fromEntries(
      incidents.map((i) => [i.emar_log_id, i.report_number || i.id.slice(0, 8)]),
    ),
    staff,
    names: Object.fromEntries(people.map((x) => [x.id, x.full_name ?? ""])),
    review: review
      ? {
          ...review,
          reviewed_by_name: people.find((x) => x.id === review.reviewed_by)?.full_name ?? null,
        }
      : null,
    grid: buildMarGrid({ month, meds, changes: allChanges, logs: doses, initials, now: a.now }),
  };
}
