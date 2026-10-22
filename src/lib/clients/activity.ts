// Activity & notes: one timeline of shifts, daily logs and incidents, newest
// first, with filter pills. Incidents need Incidents: View; whoever can't see
// them gets neither the pill nor the rows. Pure — importable by node --test.

export type ActivityKind = "shift" | "daily_log" | "incident";
export type ActivityFilter = "all" | ActivityKind;

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  shift: "Shift note",
  daily_log: "Daily log",
  incident: "Incident",
};

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All",
  shift: "Shift notes",
  daily_log: "Daily logs",
  incident: "Incidents",
};

export type ActivityViewer = { canSeeIncidents: boolean };

/** The kinds this viewer may see. */
export function visibleKinds(v: ActivityViewer): ActivityKind[] {
  return (["shift", "daily_log", "incident"] as const).filter(
    (k) => k !== "incident" || v.canSeeIncidents,
  );
}

/** The filter pills for this viewer, in order. */
export function activityFilters(v: ActivityViewer): { value: ActivityFilter; label: string }[] {
  return (["all", ...visibleKinds(v)] as ActivityFilter[]).map((value) => ({
    value,
    label: FILTER_LABELS[value],
  }));
}

export type ActivityEntry = {
  key: string;
  kind: ActivityKind;
  id: string;
  /** ISO timestamp or YYYY-MM-DD; sorts newest first. */
  at: string | null;
  authorId: string | null;
  code: string | null;
  preview: string;
};

export type ShiftSource = {
  id: string;
  clock_in_timestamp: string | null;
  staff_id: string | null;
  service_type_code: string | null;
  shift_note_text: string | null;
};
export type LogSource = { id: string; log_date: string | null; user_id: string | null; narrative: string | null };
export type IncidentSource = {
  id: string;
  incident_date: string | null;
  reported_by: string | null;
  incident_types: string[] | null;
  description: string | null;
};

const PREVIEW = 160;

/** First line-ish of a text, trimmed to a preview. */
export function previewText(text: string | null | undefined, empty: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return empty;
  return t.length > PREVIEW ? `${t.slice(0, PREVIEW - 1)}…` : t;
}

/** Comparable key: date-only values sort as the end of that day. */
function sortKey(at: string | null): string {
  if (!at) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T23:59:59` : at;
}

/**
 * The timeline for this viewer: every source turned into entries, kinds the
 * viewer can't see dropped (even if rows were passed), newest first.
 */
export function buildTimeline(
  sources: {
    shifts?: readonly ShiftSource[];
    logs?: readonly LogSource[];
    incidents?: readonly IncidentSource[];
  },
  viewer: ActivityViewer,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...(sources.shifts ?? []).map((s) => ({
      key: `shift:${s.id}`,
      kind: "shift" as const,
      id: s.id,
      at: s.clock_in_timestamp,
      authorId: s.staff_id,
      code: s.service_type_code,
      preview: previewText(s.shift_note_text, "No shift note."),
    })),
    ...(sources.logs ?? []).map((l) => ({
      key: `daily_log:${l.id}`,
      kind: "daily_log" as const,
      id: l.id,
      at: l.log_date,
      authorId: l.user_id,
      code: null,
      preview: previewText(l.narrative, "No note text."),
    })),
    ...(sources.incidents ?? []).map((i) => ({
      key: `incident:${i.id}`,
      kind: "incident" as const,
      id: i.id,
      at: i.incident_date,
      authorId: i.reported_by,
      code: null,
      preview: previewText(
        [(i.incident_types ?? []).join(", "), i.description].filter(Boolean).join(": "),
        "No details.",
      ),
    })),
  ];
  const allowed = new Set(visibleKinds(viewer));
  return entries
    .filter((e) => allowed.has(e.kind))
    .sort((a, b) => sortKey(b.at).localeCompare(sortKey(a.at)));
}

export function filterTimeline(entries: readonly ActivityEntry[], filter: ActivityFilter): ActivityEntry[] {
  return filter === "all" ? [...entries] : entries.filter((e) => e.kind === filter);
}

/** Clock-in to clock-out in hours (one decimal), or null while open. */
export function shiftHours(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const ms = Date.parse(clockOut) - Date.parse(clockIn);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / 3_600_000) * 10) / 10;
}
