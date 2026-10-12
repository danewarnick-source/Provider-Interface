// What "Draft with Nectar" sends and how its answer is checked, without the
// server parts: which boxes get drafted and from which records, the prompt
// (a summary of the whole period, never a log), and the fact checks on what
// comes back (buildDrafts). draftSummaryBoxes loads the data, calls the
// model and saves; everything in between lives here. Pure, node --test.

import {
  EVIDENCE_KIND_LABEL,
  filledIncidents,
  groupEvidence,
  manualIncidentLine,
  type SummaryEditorState,
  type SummaryEvidence,
} from "./progress-summary-doc.ts";
import {
  buildDrafts,
  fieldGoalId,
  fieldText,
  nothingChanged,
  textFields,
  type BoxDraft,
  type DraftFailure,
  type FieldKey,
} from "./progress-summary-review.ts";
import type { SummaryGoal } from "./clients/plan-summaries.ts";

export const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// Records go in dated (so Nectar can see the trend over the period) but
// without staff names or report numbers, which never belong in a summary.
function evidenceBlock(list: readonly SummaryEvidence[], n = 600): string {
  return list.length
    ? list
        .map((e) => `- [${e.date}] ${EVIDENCE_KIND_LABEL[e.kind]}${e.code ? ` (${e.code})` : ""}: ${clip(e.text, n)}`)
        .join("\n")
    : "(none)";
}

const NEVER_INVENT = `- NEVER invent anything: no events, activities, numbers, names, medications, staff actions, conversations, milestones, regressions, quotes, recommendations or plans that are not in that box's text or its records. Any number you write must already be there.`;

const STYLE = `- Past tense, third person, professional, objective. Plain sentences in one paragraph: no headings, bullets, markdown or code fences.`;

/** How a box reads: a summary of the whole period, never a retelling of the notes. */
const SUMMARY_STYLE = `WRITE A SUMMARY OF THE WHOLE PERIOD, NOT A LOG:
- Group what happened by theme. Show the trend over the period (e.g. "went from needing three prompts to needing one"), how often things happened ("most days", "weekly", "a few times"), the level of support needed, and how the person responded.
- NO dates, times or days of the week. NO staff names. NO report numbers. No shift-by-shift or note-by-note retelling, and never sentences like "On October 9th…" or "During one shift…".
- At most one short quote per box, and only if it shows the person's own view in their own words from the records.
- Goal boxes: one paragraph, 3–6 sentences, about progress on that goal.
- General notes: one paragraph, 2–4 sentences: the services provided, how the person did overall, and anything notable not tied to a goal.
- Incident notes: one short paragraph: a plain description of each incident, its outcome, and whether restraint was used (only if the records say). No report numbers or dates. When any incident report or added incident is listed, describe them; NEVER write that there were no incidents.

EXAMPLE of the style (a goal box):
"Joby made steady progress on laundry, cooking and budgeting this period. She went from needing three prompts to complete a load of laundry to needing one, usually a reminder to clean the lint trap, and now sorts, washes, dries and puts away her clothes on her own. She cooked simple dinners such as baked chicken and rice, setting the oven and timer herself while staff checked that food was done. She completed her weekly budget review with one or two prompts. Joby told staff, "I almost did it all by myself.""`;

export interface DraftRequest {
  editor: SummaryEditorState;
  /** The summary's goals (none when the codes carry no goal progress). */
  goals: readonly SummaryGoal[];
  evidence: readonly SummaryEvidence[];
  /** The boxes asked for. */
  fields: readonly FieldKey[];
  person: { firstName: string | null; lastName: string | null };
  services: readonly string[];
  cadence: string | null;
}

export interface DraftPlan {
  /** The boxes that get drafted: asked for and with text or records. */
  boxes: FieldKey[];
  /** Asked for but not drafted (unknown, or nothing to draft from). */
  skipped: number;
  system: string;
  user: string;
  /** Incident reports in the period, for the saved draft_source. */
  incidentIds: string[];
  /** Checks Nectar's raw answer: the drafts to write and why the rest weren't used. */
  check: (raw: string) => { drafts: BoxDraft[]; failed: DraftFailure[] };
}

export function parseJson(raw: string): Record<string, unknown> {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return tryParse(raw) ?? tryParse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "") ?? {};
}

/** Nectar's per-box text from {"general","goals":{id},"incidentNotes"}. */
function proposedFields(parsed: Record<string, unknown>, fields: readonly FieldKey[]): Map<FieldKey, string> {
  const out = new Map<FieldKey, string>();
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const goals = (parsed.goals && typeof parsed.goals === "object" ? parsed.goals : {}) as Record<string, unknown>;
  for (const f of fields) {
    const id = fieldGoalId(f);
    const t = id !== null ? str(goals[id]) : str(parsed[f]);
    if (t) out.set(f, t);
  }
  return out;
}

/** The boxes to draft, the prompt, and the check on what comes back. */
export function planDraft(req: DraftRequest): DraftPlan {
  const { editor, goals } = req;
  const grouped = groupEvidence(goals, req.evidence);
  const order = textFields(goals.map((g) => g.id));
  const known = new Set<FieldKey>(order);
  const line = (e: SummaryEvidence) => `${e.date} ${e.text}`;
  const reportLines = grouped.incidents.map(line);
  const addedIncidents = filledIncidents(editor.incidents).map(manualIncidentLine);
  // What a box is drafted from besides its text: a goal's records, the
  // period's incident reports and added incidents, or (general notes, which
  // cover the services and how the person did overall) every note.
  const notes = req.evidence.filter((e) => e.kind !== "incident");
  const recordsFor = (f: FieldKey): string[] => {
    if (f === "incidentNotes") return [...reportLines, ...addedIncidents];
    if (f === "general") return notes.map(line);
    const id = fieldGoalId(f);
    return id === null ? [] : (grouped.byGoal[id] ?? []).map(line);
  };
  // A box is drafted when it has text or records.
  const wanted = [...new Set(req.fields)].filter((f) => known.has(f));
  const boxes = wanted.filter((f) => fieldText(editor, f).trim() || recordsFor(f).length > 0);

  const firstName = req.person.firstName?.trim() || "the person";
  const goalOf = (f: FieldKey) => goals.find((g) => g.id === fieldGoalId(f));
  const indent = (s: string) => s.replace(/^/gm, "  ");
  const boxBlock = boxes
    .map((f) => {
      const g = goalOf(f);
      const text = clip(fieldText(editor, f), 6000) || "(empty)";
      if (g) {
        return `BOX "${f}" — progress on the goal: ${g.goal}
  Text: ${text}
  Records for this goal:
${indent(evidenceBlock(grouped.byGoal[g.id] ?? []))}`;
      }
      if (f === "incidentNotes") {
        return `BOX "${f}" — incident notes
  Text: ${text}
  Incident reports this period:
${indent(evidenceBlock(grouped.incidents))}
  Incidents the admin added:
${indent(addedIncidents.length ? addedIncidents.map((l) => `- ${l}`).join("\n") : "(none)")}`;
      }
      return `BOX "${f}" — general notes
  Text: ${text}
  All notes this period:
${indent(evidenceBlock(notes))}`;
    })
    .join("\n\n");

  const system = `You are NECTAR, drafting boxes of a Utah DSPD ${req.cadence ?? "quarterly"} progress summary for an admin to review. You advise; the admin decides.

${SUMMARY_STYLE}

RULES:
- Write EACH box on its own, using only what is in that box's text and the records listed under it (a goal's records; the incident reports and added incidents; all notes for the general notes). A box with no text is written from its records. Text the admin typed is the most important source: keep its meaning, and keep any plans for next period it states.
- Do NOT move text from one box to another. Do not write about other boxes.
- Never write the same sentence twice.
${NEVER_INVENT}
${STYLE} Use ${firstName}'s first name naturally.
- Output STRICT JSON only: {"general":"…","goals":{"<goal id>":"…"},"incidentNotes":"…"}. Include only the boxes listed below; a goal's id is the part of the box name after "goal:".`;
  const user = `PERSON: ${req.person.firstName ?? ""} ${req.person.lastName ?? ""}\nSERVICES: ${req.services.join(", ") || "(none)"}\n\n${boxBlock}`;

  const check = (raw: string) => {
    const proposed = proposedFields(parseJson(raw), boxes);
    const current = new Map<FieldKey, string>(order.map((f) => [f, fieldText(editor, f)]));
    const built = buildDrafts({
      current,
      proposed,
      extra: recordsFor,
      order,
      hasIncidents: reportLines.length + addedIncidents.length > 0,
    });
    // A box Nectar returned nothing for is left as it is, and says so.
    const answered = new Set([...built.drafts, ...built.failed].map((d) => d.field));
    return {
      drafts: built.drafts,
      failed: [...built.failed, ...boxes.filter((f) => !answered.has(f)).map(nothingChanged)],
    };
  };

  return {
    boxes,
    skipped: req.fields.length - boxes.length,
    system,
    user,
    incidentIds: grouped.incidents.map((i) => i.id),
    check,
  };
}
