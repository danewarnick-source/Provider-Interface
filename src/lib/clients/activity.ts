// Activity & notes: one timeline of shifts, daily logs, incidents and office
// notes, newest first, with filter pills. Office notes are office-only
// (Clients: Edit); incidents need Incidents: View. Whoever can't see a kind
// gets neither its pill nor its rows. Pure — importable by node --test.

export type ActivityKind = "shift" | "daily_log" | "incident" | "office_note";
export type ActivityFilter = "all" | ActivityKind;

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  shift: "Shift note",
  daily_log: "Daily log",
  incident: "Incident",
  office_note: "Office note",
};

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All",
  shift: "Shift notes",
  daily_log: "Daily logs",
  incident: "Incidents",
  office_note: "Office notes",
};

export type ActivityViewer = { canSeeIncidents: boolean; canSeeOfficeNotes: boolean };

/** The kinds this viewer may see. */
export function visibleKinds(v: ActivityViewer): ActivityKind[] {
  return (["shift", "daily_log", "incident", "office_note"] as const).filter(
    (k) =>
      (k !== "incident" || v.canSeeIncidents) && (k !== "office_note" || v.canSeeOfficeNotes),
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
  /** Office notes: only people who can edit clients see them. */
  officeOnly: boolean;
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
export type NoteSource = { id: string; created_at: string; created_by: string | null; body: string };

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
    notes?: readonly NoteSource[];
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
      officeOnly: false,
    })),
    ...(sources.logs ?? []).map((l) => ({
      key: `daily_log:${l.id}`,
      kind: "daily_log" as const,
      id: l.id,
      at: l.log_date,
      authorId: l.user_id,
      code: null,
      preview: previewText(l.narrative, "No note text."),
      officeOnly: false,
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
      officeOnly: false,
    })),
    ...(sources.notes ?? []).map((n) => ({
      key: `office_note:${n.id}`,
      kind: "office_note" as const,
      id: n.id,
      at: n.created_at,
      authorId: n.created_by,
      code: null,
      preview: previewText(n.body, ""),
      officeOnly: true,
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
