// The documentation one progress summary is written from: the goals of the
// plan in effect at period end (with the supports for the summary's codes)
// and the period's evidence — approved daily logs, submitted shift notes
// (evv_timesheets) and shift reports, and incident reports involving the
// client. Shared by the editor (getSummaryWithSource) and the Nectar draft.
// Callers check access.

import { loadPlanBundle } from "@/lib/clients/plans-load";
import { summaryGoals, type SummaryGoal } from "@/lib/clients/plan-summaries";
import { incidentInvolvesClientOr } from "@/lib/incident-visibility";
import {
  evidenceFromRows,
  type EvidenceRows,
  type SummaryEvidence,
} from "@/lib/progress-summary-doc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export interface SummarySource {
  planId: string | null;
  goals: SummaryGoal[];
  evidence: SummaryEvidence[];
  /** Team members who wrote the period's logs, notes and reports. */
  staffNames: string[];
}

export async function loadSummarySource(
  sb: AnySupabase,
  organizationId: string,
  row: {
    client_id: string;
    period_start: string;
    period_end: string;
    service_codes: string[] | null;
  },
): Promise<SummarySource> {
  const codes = (row.service_codes ?? []).map((c) => c.toUpperCase());
  const from = `${row.period_start}T00:00:00`;
  const to = `${row.period_end}T23:59:59`;
  const check = <T>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as T;
  };
  const [bundle, logsRes, notesRes, reportsRes, incidentsRes] = await Promise.all([
    loadPlanBundle(sb, row.client_id),
    sb
      .from("daily_logs")
      .select("id, log_date, narrative, pcsp_goals_addressed, goal_ids, user_id")
      .eq("organization_id", organizationId)
      .eq("client_id", row.client_id)
      .eq("status", "approved")
      .gte("log_date", row.period_start)
      .lte("log_date", row.period_end)
      .order("log_date", { ascending: true })
      .limit(500),
    sb
      .from("evv_timesheets")
      .select(
        "id, clock_in_timestamp, shift_note_text, staff_id, service_type_code, goal_ids, goals_completed",
      )
      .eq("organization_id", organizationId)
      .eq("client_id", row.client_id)
      .not("clock_out_timestamp", "is", null)
      .not("shift_note_text", "is", null)
      .is("denied_at", null)
      .gte("clock_in_timestamp", from)
      .lte("clock_in_timestamp", to)
      .order("clock_in_timestamp", { ascending: true })
      .limit(500),
    sb
      .from("shift_reports")
      .select("id, created_at, narrative, staff_id, scheduled_shift_id")
      .eq("organization_id", organizationId)
      .eq("client_id", row.client_id)
      .not("submitted_at", "is", null)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true })
      .limit(200),
    sb
      .from("incident_reports")
      .select("id, report_number, incident_date, incident_types, narrative_during")
      .eq("organization_id", organizationId)
      .or(incidentInvolvesClientOr(row.client_id))
      .gte("incident_date", row.period_start)
      .lte("incident_date", row.period_end)
      .order("incident_date", { ascending: true }),
  ]);
  const logs = check<EvidenceRows["logs"]>(logsRes);
  const notes = check<EvidenceRows["shiftNotes"]>(notesRes);
  const reports =
    check<
      Array<
        Omit<EvidenceRows["reports"][number], "service_code"> & {
          scheduled_shift_id: string | null;
        }
      >
    >(reportsRes);
  const incidents = check<EvidenceRows["incidents"]>(incidentsRes);

  const shiftIds = [
    ...new Set(reports.map((r) => r.scheduled_shift_id).filter(Boolean)),
  ] as string[];
  const codeByShift = new Map<string, string>();
  if (shiftIds.length) {
    const { data } = await sb
      .from("scheduled_shifts")
      .select("id, service_code")
      .in("id", shiftIds);
    for (const s of (data ?? []) as Array<{ id: string; service_code: string | null }>) {
      if (s.service_code) codeByShift.set(s.id, s.service_code.toUpperCase());
    }
  }

  // profiles keyed by auth user id — a separate query, never an embed.
  const staffIds = [
    ...new Set([
      ...logs.map((l) => l.user_id),
      ...notes.map((n) => n.staff_id),
      ...reports.map((r) => r.staff_id),
    ]),
  ].filter(Boolean) as string[];
  const names = new Map<string, string>();
  if (staffIds.length) {
    const { data } = await sb
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", staffIds);
    for (const p of (data ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Team member");
    }
  }

  const { planId, goals } = summaryGoals(bundle, row.period_end, codes);
  const evidence = evidenceFromRows({
    logs,
    shiftNotes: notes,
    reports: reports.map((r) => ({
      ...r,
      service_code: r.scheduled_shift_id ? (codeByShift.get(r.scheduled_shift_id) ?? null) : null,
    })),
    incidents,
    names,
  });
  const staffNames = [
    ...new Set(
      evidence
        .filter((e) => e.kind !== "incident")
        .map((e) => e.who)
        .filter(Boolean),
    ),
  ]
    .map(String)
    .sort();
  return { planId, goals, evidence, staffNames };
}
