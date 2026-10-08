// The progress summary document: what the editor shows, what the PDF prints
// and the text saved as the summary. Same shape as the support strategies
// document: header (provider, client, support coordinator, period, services,
// cadence/due), then each goal → its supports ("Support:", "Support
// details:") → "Progress / summary of services" → the evidence pulled for
// that goal (approved daily logs, submitted shift notes), then General
// (evidence not tied to a goal), Incidents and general notes.
//
// Also the editor state saved with the draft. Nectar never writes into it
// directly: its rewrites are suggestions (progress-summary-review.ts) the
// person accepts or keeps their own text. Pure (no Supabase), node --test.

import { formatDate } from "./clients/dates.ts";
import {
  noteAddressesGoal,
  summaryPeriodName,
  type SummaryGoal,
} from "./clients/plan-summaries.ts";
import { summaryCadenceLabel } from "./progress-summaries.ts";

// ─── Evidence ──────────────────────────────────────────────────────────────

export type EvidenceKind = "daily_log" | "shift_note" | "shift_report" | "incident";

/** One piece of documentation in the period, as the editor lists it. */
export interface SummaryEvidence {
  id: string;
  kind: EvidenceKind;
  /** YYYY-MM-DD */
  date: string;
  /** Who wrote it (team member), or the incident report number. */
  who: string | null;
  text: string;
  /** Goal ids the note recorded (daily log / shift note checklists). */
  goalIds: string[];
  /** Goal labels older notes recorded ("Goal — support"). */
  labels: string[];
  code: string | null;
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  daily_log: "Daily log",
  shift_note: "Shift note",
  shift_report: "Shift report",
  incident: "Incident",
};

/** Whitespace collapsed, cut to `max` characters with "…". */
export function oneLine(text: string | null | undefined, max = 140): string {
  const s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** "Oct 3, 2026 · Sam Lee · Cooked pasta with prompts…" */
export function evidenceLine(e: SummaryEvidence): string {
  return [
    formatDate(e.date),
    e.who?.trim() || EVIDENCE_KIND_LABEL[e.kind],
    oneLine(e.text) || "(no text)",
  ].join(" · ");
}

export interface GroupedEvidence {
  byGoal: Record<string, SummaryEvidence[]>;
  /** Logs and shift notes not tied to any goal of this summary. */
  general: SummaryEvidence[];
  incidents: SummaryEvidence[];
}

/**
 * Evidence under the goals it addressed (by goal id, or by the goal label
 * older notes wrote), the rest under General; incidents on their own. A note
 * that worked on two goals shows under both.
 */
export function groupEvidence(
  goals: ReadonlyArray<Pick<SummaryGoal, "id" | "goal">>,
  evidence: readonly SummaryEvidence[],
): GroupedEvidence {
  const out: GroupedEvidence = { byGoal: {}, general: [], incidents: [] };
  for (const g of goals) out.byGoal[g.id] = [];
  for (const e of evidence) {
    if (e.kind === "incident") {
      out.incidents.push(e);
      continue;
    }
    const hits = goals.filter((g) =>
      noteAddressesGoal({ goal_ids: e.goalIds, addressed: e.labels }, g),
    );
    if (!hits.length) out.general.push(e);
    for (const g of hits) out.byGoal[g.id].push(e);
  }
  return out;
}

/** The Utah calendar day of a timestamp (shifts are clocked in Mountain time). */
export function utahDay(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d);
}

export interface EvidenceRows {
  /** Approved daily logs. */
  logs: ReadonlyArray<{
    id: string;
    log_date: string;
    narrative: string | null;
    user_id: string | null;
    goal_ids: string[] | null;
    pcsp_goals_addressed: string[] | null;
  }>;
  /** Submitted shift notes (evv_timesheets with a note, clocked out, not denied). */
  shiftNotes: ReadonlyArray<{
    id: string;
    clock_in_timestamp: string;
    shift_note_text: string | null;
    staff_id: string | null;
    service_type_code: string | null;
    goal_ids: string[] | null;
    goals_completed: unknown;
  }>;
  /** Submitted shift reports (scheduled shifts). */
  reports: ReadonlyArray<{
    id: string;
    created_at: string;
    narrative: string | null;
    staff_id: string | null;
    service_code: string | null;
  }>;
  incidents: ReadonlyArray<{
    id: string;
    report_number: string | null;
    incident_date: string;
    incident_types: string[] | null;
    narrative_during: string | null;
  }>;
  /** Team member names by user id. */
  names: ReadonlyMap<string, string>;
}

/** The period's documentation as evidence, oldest first; notes with no text dropped. */
export function evidenceFromRows(r: EvidenceRows): SummaryEvidence[] {
  const name = (id: string | null) => (id ? (r.names.get(id) ?? null) : null);
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const out: SummaryEvidence[] = [
    ...r.logs.map((l) => ({
      id: l.id,
      kind: "daily_log" as const,
      date: l.log_date.slice(0, 10),
      who: name(l.user_id),
      text: l.narrative ?? "",
      goalIds: strings(l.goal_ids),
      labels: strings(l.pcsp_goals_addressed),
      code: null,
    })),
    ...r.shiftNotes.map((n) => ({
      id: n.id,
      kind: "shift_note" as const,
      date: utahDay(n.clock_in_timestamp),
      who: name(n.staff_id),
      text: n.shift_note_text ?? "",
      goalIds: strings(n.goal_ids),
      labels: strings(n.goals_completed),
      code: n.service_type_code?.toUpperCase() ?? null,
    })),
    ...r.reports.map((x) => ({
      id: x.id,
      kind: "shift_report" as const,
      date: utahDay(x.created_at),
      who: name(x.staff_id),
      text: x.narrative ?? "",
      goalIds: [],
      labels: [],
      code: x.service_code,
    })),
    ...r.incidents.map((i) => {
      const types = (i.incident_types ?? []).join(", ");
      return {
        id: i.id,
        kind: "incident" as const,
        date: i.incident_date.slice(0, 10),
        who: i.report_number ? `#${i.report_number}` : null,
        text: [types, i.narrative_during ?? ""].filter((t) => t.trim()).join(": "),
        goalIds: [],
        labels: [],
        code: null,
      };
    }),
  ];
  return out
    .filter((e) => e.kind === "incident" || e.text.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Editor state (saved in client_progress_summaries.draft_source.editor) ──

export interface ManualIncident {
  id: string;
  date: string;
  what: string;
  followUp: string;
}

export interface SummaryEditorState {
  general: string;
  goals: Record<string, string>;
  incidents: ManualIncident[];
  incidentNotes: string;
  /** The Nectar suggestion each field last took (Accept); marks the summary as a draft until Finalize. */
  nectar: { general: string; incidentNotes: string; goals: Record<string, string> };
}

export function emptyEditorState(): SummaryEditorState {
  return {
    general: "",
    goals: {},
    incidents: [],
    incidentNotes: "",
    nectar: { general: "", incidentNotes: "", goals: {} },
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strMap = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) as Record<
        string,
        string
      >)
    : {};

/** The saved editor state, or null when the row has none (older drafts). */
export function readEditorState(raw: unknown): SummaryEditorState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const n = (r.nectar ?? {}) as Record<string, unknown>;
  return {
    general: str(r.general),
    goals: strMap(r.goals),
    incidents: (Array.isArray(r.incidents) ? r.incidents : [])
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i, idx) => ({
        id: str(i.id) || `m${idx + 1}`,
        date: str(i.date),
        what: str(i.what),
        followUp: str(i.followUp),
      })),
    incidentNotes: str(r.incidentNotes),
    nectar: {
      general: str(n.general),
      incidentNotes: str(n.incidentNotes),
      goals: strMap(n.goals),
    },
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * An older draft saved only as text ("GENERAL SUMMARY" / "Goal: …"
 * sections) read back into fields. Text with no such sections stays whole
 * in the general notes, so nothing is lost.
 */
export function editorFromLegacyText(
  text: string | null | undefined,
  goals: ReadonlyArray<Pick<SummaryGoal, "id" | "goal">>,
): SummaryEditorState {
  const state = emptyEditorState();
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return state;
  const next = "(?=\\nGoal:|\\nGOAL PROGRESS|\\n[A-Z][A-Z ]{2,}(?::|\\n)|$)";
  const gen = new RegExp(`GENERAL SUMMARY[^\\n]*\\n([\\s\\S]*?)${next}`).exec(raw);
  let found = !!gen;
  state.general = gen?.[1]?.trim() ?? "";
  for (const g of goals) {
    const m = new RegExp(
      `Goal:\\s*${escapeRe(g.goal.trim())}[^\\n]*\\n([\\s\\S]*?)${next}`,
      "i",
    ).exec(raw);
    if (m) {
      found = true;
      state.goals[g.id] = m[1].trim();
    }
  }
  if (!found) state.general = raw.trim();
  return state;
}

// ─── Nectar text ───────────────────────────────────────────────────────────

export const NO_EVIDENCE_TEXT =
  "No approved daily logs, shift notes or incidents for this goal this period — type the progress.";

/** True when a field still holds text taken from a Nectar suggestion (shown as a draft until Finalize). */
export function hasNectarText(editor: SummaryEditorState): boolean {
  const same = (cur: string, n: string) => !!n.trim() && cur.trim() === n.trim();
  return (
    same(editor.general, editor.nectar.general) ||
    same(editor.incidentNotes, editor.nectar.incidentNotes) ||
    Object.entries(editor.nectar.goals).some(([id, n]) => same(editor.goals[id] ?? "", n))
  );
}

/** Manual incident entries with something written. */
export function filledIncidents(list: readonly ManualIncident[]): ManualIncident[] {
  return list.filter((i) => i.date.trim() || i.what.trim() || i.followUp.trim());
}

// ─── The document ──────────────────────────────────────────────────────────

export const NOT_ON_FILE = "Not on file";
export const NO_PROGRESS_TEXT = "No documentation in this period supports progress on this goal.";
export const DRAFT_MARK = "Nectar draft — review before finalizing";

export interface SummaryDocGoal {
  goal: string;
  supports: { support: string; details: string }[];
  progress: string;
  evidence: string[];
}

export interface SummaryDoc {
  title: string;
  provider: string;
  facts: [string, string][];
  draftMark: string | null;
  goals: SummaryDocGoal[];
  general: { evidence: string[]; notes: string };
  incidents: { records: string[]; manual: ManualIncident[]; notes: string };
  signoff: string[];
}

export interface SummaryDocInput {
  provider: string | null;
  clientName: string;
  coordinator: string | null;
  summary: {
    period_kind: string;
    period_label: string;
    period_start: string;
    period_end: string;
    due_date: string;
    service_codes: string[];
    include_goal_progress: boolean;
    drafted_at: string | null;
    status: string;
    finalized_at: string | null;
    finalized_by_name: string | null;
  };
  teamMembers: readonly string[];
  goals: readonly SummaryGoal[];
  evidence: readonly SummaryEvidence[];
  editor: SummaryEditorState;
  /** Set once the summary is finalized: the reviewer attested the Nectar draft. */
  aiReviewAttested?: boolean;
  filingNote?: string | null;
}

const or = (v: string | null | undefined) => (v && v.trim() ? v.trim() : NOT_ON_FILE);

/** The document model for the editor, the preview, the PDF and the saved text. */
export function buildSummaryDoc(input: SummaryDocInput): SummaryDoc {
  const s = input.summary;
  const goals = s.include_goal_progress ? input.goals : [];
  const grouped = groupEvidence(goals, input.evidence);
  const finalized = s.status === "finalized";
  const period = `${summaryPeriodName(s.period_label) ?? s.period_label} (${formatDate(s.period_start)} – ${formatDate(s.period_end)})`;
  const signoff: string[] = [];
  if (finalized) {
    signoff.push(`Finalized ${formatDate(s.finalized_at)} by ${or(s.finalized_by_name)}.`);
    if (input.aiReviewAttested) {
      signoff.push("Reviewed against the documentation in Provider Interface before finalizing.");
    }
  }
  if (input.filingNote) signoff.push(input.filingNote);
  return {
    title: "Progress Summary",
    provider: or(input.provider),
    facts: [
      ["Client", or(input.clientName)],
      ["Service provider", or(input.provider)],
      ["Support coordinator", or(input.coordinator)],
      ["Period", period],
      ["Services", s.service_codes.join(", ") || "None"],
      ["Cadence", summaryCadenceLabel(s.period_kind, s.service_codes)],
      ["Due", formatDate(s.due_date)],
      ["Team members", input.teamMembers.join(", ") || "None"],
    ],
    draftMark: !finalized && (s.drafted_at || hasNectarText(input.editor)) ? DRAFT_MARK : null,
    goals: goals.map((g) => ({
      goal: g.goal,
      supports: g.supports.map((x) => ({ support: x.support || "Support", details: x.details })),
      progress: (input.editor.goals[g.id] ?? "").trim(),
      evidence: (grouped.byGoal[g.id] ?? []).map(evidenceLine),
    })),
    general: {
      evidence: grouped.general.map(evidenceLine),
      notes: input.editor.general.trim(),
    },
    incidents: {
      records: grouped.incidents.map(evidenceLine),
      manual: filledIncidents(input.editor.incidents),
      notes: input.editor.incidentNotes.trim(),
    },
    signoff,
  };
}

/** "Evidence this period (3)": the heading over an evidence list. */
export function evidenceHeading(count: number): string {
  return `Evidence this period (${count})`;
}

/** The document as plain text: saved as the draft / final content. */
export function summaryDocText(doc: SummaryDoc): string {
  const lines: string[] = [doc.provider, doc.title.toUpperCase()];
  if (doc.draftMark) lines.push(doc.draftMark);
  lines.push("", ...doc.facts.map(([k, v]) => `${k}: ${v}`));
  doc.goals.forEach((g, i) => {
    lines.push("", `GOAL ${i + 1}: ${g.goal}`);
    for (const s of g.supports) {
      lines.push(`Support: ${s.support}`);
      if (s.details) lines.push(`Support details: ${s.details}`);
    }
    lines.push("Progress / summary of services:", g.progress || NO_PROGRESS_TEXT);
    lines.push(`${evidenceHeading(g.evidence.length)}:`, ...g.evidence.map((e) => `- ${e}`));
  });
  lines.push("", "GENERAL");
  if (doc.general.evidence.length) {
    lines.push(
      `${evidenceHeading(doc.general.evidence.length)}:`,
      ...doc.general.evidence.map((e) => `- ${e}`),
    );
  }
  lines.push("", `INCIDENTS (${doc.incidents.records.length + doc.incidents.manual.length})`);
  for (const r of doc.incidents.records) lines.push(`- ${r}`);
  for (const m of doc.incidents.manual) lines.push(`- ${manualIncidentLine(m)}`);
  if (doc.incidents.notes) lines.push(doc.incidents.notes);
  if (!doc.incidents.records.length && !doc.incidents.manual.length && !doc.incidents.notes) {
    lines.push("No incidents this period.");
  }
  lines.push("", "GENERAL NOTES", doc.general.notes || "None.");
  if (doc.signoff.length) lines.push("", ...doc.signoff);
  return lines.join("\n");
}

/** "Oct 3, 2026 · Fell in kitchen · Follow-up: Nurse checked, no injury" */
export function manualIncidentLine(m: ManualIncident): string {
  return [
    m.date ? formatDate(m.date) : "Date not given",
    oneLine(m.what, 400) || "(not described)",
    m.followUp.trim() ? `Follow-up: ${oneLine(m.followUp, 400)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "progress-summary-pat-example-2026-q4.pdf". */
export function summaryFileName(clientName: string, periodLabel: string): string {
  const slug = `${clientName} ${periodLabel.replace(/-FS$/, "")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `progress-summary-${slug || "client"}.pdf`;
}
