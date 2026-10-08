// Nectar as a helper on a progress summary, never a gate.
//
// This module is the pure part:
//   - the guards on Nectar's per-box rewrites: every date and number in a
//     rewrite must come from that box's text (or its goal's records)
//     (unsupportedFacts), the person's own dates and numbers must survive
//     (droppedFacts), sentences are never repeated (dedupeFields);
//   - the goal check, decided in code (goalCovered): a goal is covered when
//     its progress shares a meaningful word, stem or synonym with the goal
//     or its supports. Only zero overlap is ever put to Nectar, as a yes/no;
//   - reminders (summaryReminders): fixed wording written here, never by
//     the AI, max one per goal and two for the general notes;
//   - Accept / Undo of a rewrite and the review state saved in
//     client_progress_summaries.draft_source.review.
// Nothing here blocks Finalize. Node --test.

import type { SummaryEditorState } from "./progress-summary-doc.ts";
import { summaryRequirements } from "./progress-summary-requirements.ts";

// ─── Fields ────────────────────────────────────────────────────────────────

/** A place in the editor a reminder or a suggestion is about. */
export type FieldKey = "general" | "incidentNotes" | `goal:${string}` | `incident:${string}`;

export const goalField = (id: string): FieldKey => `goal:${id}`;

/** The goal id of a "goal:<id>" field, else null. */
export function fieldGoalId(field: string): string | null {
  return field.startsWith("goal:") ? field.slice(5) : null;
}

/** The text a field holds now. */
export function fieldText(editor: SummaryEditorState, field: FieldKey): string {
  if (field === "general") return editor.general;
  if (field === "incidentNotes") return editor.incidentNotes;
  const goalId = fieldGoalId(field);
  if (goalId !== null) return editor.goals[goalId] ?? "";
  const m = editor.incidents.find((i) => `incident:${i.id}` === field);
  return m ? [m.what, m.followUp].filter((t) => t.trim()).join(" ") : "";
}

/** The writable text fields (general, incident notes, each goal), goals first. */
export function textFields(goalIds: readonly string[]): FieldKey[] {
  return [...goalIds.map(goalField), "general", "incidentNotes"];
}

// ─── Dates in text ─────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// A month name on its own counts only spelled out (and never "May" / "March",
// which are also ordinary words); with a year any form counts.
const MONTH_ONLY_RE =
  "(january|february|april|june|july|august|september|october|november|december)";

/** A date written in the text. `day` is null for a month on its own ("in August"). */
export interface FoundDate {
  raw: string;
  index: number;
  month: number;
  day: number | null;
  year: number | null;
}

const L = "(?<![\\w/.-])";
const R = "(?![\\w/]|-\\d)";
const DATE_PATTERNS: {
  re: RegExp;
  read: (m: RegExpExecArray) => Omit<FoundDate, "raw" | "index"> | null;
}[] = [
  {
    re: new RegExp(`${L}(\\d{4})-(\\d{1,2})-(\\d{1,2})${R}`, "g"),
    read: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }),
  },
  {
    // 8/5, 8/5/26, 08/05/2026 — not fractions ("3/4 of", "1/2 cup").
    re: new RegExp(
      `${L}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${R}(?!\\s*(?:of|cups?|hours?|hrs?|miles?|mi|inch(?:es)?|lbs?|pounds?)\\b)`,
      "gi",
    ),
    read: (m) => ({
      month: +m[1],
      day: +m[2],
      year: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null,
    }),
  },
  {
    re: new RegExp(
      `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?![\\w:])`,
      "gi",
    ),
    read: (m) => ({ month: MONTHS[m[1].toLowerCase()], day: +m[2], year: m[3] ? +m[3] : null }),
  },
  {
    re: new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`,
      "gi",
    ),
    read: (m) => ({ month: MONTHS[m[2].toLowerCase()], day: +m[1], year: m[3] ? +m[3] : null }),
  },
  {
    re: new RegExp(`\\b${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`, "gi"),
    read: (m) => ({ month: MONTHS[m[1].toLowerCase()], day: null, year: +m[2] }),
  },
  {
    re: new RegExp(`\\b${MONTH_ONLY_RE}\\b`, "gi"),
    read: (m) => ({ month: MONTHS[m[1].toLowerCase()], day: null, year: null }),
  },
];

function validDate(d: Omit<FoundDate, "raw" | "index">): boolean {
  if (!d.month || d.month < 1 || d.month > 12) return false;
  if (d.day !== null && (d.day < 1 || d.day > 31)) return false;
  return d.year === null || (d.year >= 1900 && d.year <= 2100);
}

/** Every date written in `text`, in order. Earlier patterns win where two overlap. */
export function findDates(text: string | null | undefined): FoundDate[] {
  const s = String(text ?? "");
  const taken: [number, number][] = [];
  const out: FoundDate[] = [];
  for (const { re, read } of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      const d = read(m);
      if (!d || !validDate(d)) continue;
      taken.push([start, end]);
      out.push({ raw: m[0].trim(), index: start, ...d });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

// ─── Facts (dates and numbers) ─────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  once: 1,
  twice: 2,
};

/**
 * The dates and numbers in `text`, by a key that ignores how they are
 * written ("8/5" and "August 5" are the same date). With `words`, spelled-out
 * numbers ("three", "twice") count too.
 */
export function factTokens(text: string | null | undefined, words = false): Map<string, string> {
  const s = String(text ?? "");
  const out = new Map<string, string>();
  const add = (k: string, raw: string) => {
    if (!out.has(k)) out.set(k, raw);
  };
  let masked = s;
  for (const d of findDates(s)) {
    if (d.day !== null) add(`d:${d.month}/${d.day}`, d.raw);
    add(`m:${d.month}`, d.raw);
    if (d.year !== null) add(`n:${d.year}`, d.raw);
    masked =
      masked.slice(0, d.index) + " ".repeat(d.raw.length) + masked.slice(d.index + d.raw.length);
  }
  for (const m of masked.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?!\w)/g)) {
    const n = String(Number(m[0].replace(/,/g, "")));
    if (n !== "NaN") add(`n:${n}`, m[0]);
  }
  if (words) {
    for (const m of s.matchAll(/\b[a-z]+\b/gi)) {
      const n = NUMBER_WORDS[m[0].toLowerCase()];
      if (n !== undefined) add(`n:${n}`, m[0]);
    }
  }
  return out;
}

const uniq = (list: string[]) => [...new Set(list)];

/** Dates and numbers in `text` that appear in none of `sources` — e.g. a rewrite's invented facts. */
export function unsupportedFacts(text: string, sources: readonly string[]): string[] {
  const allowed = new Set<string>();
  for (const src of sources) for (const k of factTokens(src, true).keys()) allowed.add(k);
  return uniq(
    [...factTokens(text).entries()].filter(([k]) => !allowed.has(k)).map(([, raw]) => raw),
  );
}

/** Dates and numbers the person typed that `after` no longer has. */
export function droppedFacts(typed: string, after: readonly string[]): string[] {
  const kept = new Set<string>();
  for (const t of after) for (const k of factTokens(t, true).keys()) kept.add(k);
  return uniq([...factTokens(typed).entries()].filter(([k]) => !kept.has(k)).map(([, raw]) => raw));
}

// ─── Sentences ─────────────────────────────────────────────────────────────

/** Sentences of one line of text. */
export function splitSentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const sentenceKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The fields with every repeated sentence dropped — within a field and
 * across fields. The first field listed keeps a sentence; pass goals first.
 */
export function dedupeFields(fields: ReadonlyArray<[FieldKey, string]>): Map<FieldKey, string> {
  const seen = new Set<string>();
  const out = new Map<FieldKey, string>();
  for (const [field, text] of fields) {
    const lines = String(text ?? "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => {
        const kept = splitSentences(line).filter((s) => {
          const k = sentenceKey(s);
          if (!k) return true;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return kept.join(" ");
      });
    out.set(
      field,
      lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );
  }
  return out;
}

// ─── Suggestions ───────────────────────────────────────────────────────────

/** Nectar's rewrite of one box, offered as Accept / x. */
export interface FieldSuggestion {
  field: FieldKey;
  text: string;
  /** Dates / numbers the person typed that this rewrite loses. No one-click accept when set. */
  drops: string[];
}

export interface SuggestionInput {
  /** The text each box holds now. */
  current: ReadonlyMap<FieldKey, string>;
  /** Nectar's text per box (only the boxes it rewrote). */
  proposed: ReadonlyMap<FieldKey, string>;
  /** Extra text a box's rewrite may take dates and numbers from (a goal's records and supports). */
  extra: (field: FieldKey) => readonly string[];
  /** Box order for dedupe (goals first). */
  order: readonly FieldKey[];
}

export interface SuggestionResult {
  suggestions: FieldSuggestion[];
  /** Boxes whose rewrite was dropped, with the dates / numbers it made up. */
  rejected: { field: FieldKey; facts: string[] }[];
}

/**
 * Nectar's rewrites made safe to offer: a rewrite with a date or number
 * that is in neither its own box nor that box's records is dropped;
 * repeated sentences are removed; a rewrite equal to the box is not
 * offered; each suggestion lists what the person typed that it would lose.
 */
export function buildSuggestions(input: SuggestionInput): SuggestionResult {
  const rejected: SuggestionResult["rejected"] = [];
  const valid = new Map<FieldKey, string>();
  for (const [field, raw] of input.proposed) {
    const text = String(raw ?? "").trim();
    if (!text || !input.current.has(field)) continue;
    const facts = unsupportedFacts(text, [input.current.get(field) ?? "", ...input.extra(field)]);
    if (facts.length) {
      rejected.push({ field, facts });
      continue;
    }
    valid.set(field, text);
  }
  const merged = new Map(input.current);
  for (const [f, t] of valid) merged.set(f, t);
  const deduped = dedupeFields(
    input.order.filter((f) => merged.has(f)).map((f) => [f, merged.get(f) ?? ""]),
  );
  const suggestions: FieldSuggestion[] = [];
  for (const field of valid.keys()) {
    const text = deduped.get(field) ?? "";
    const typed = input.current.get(field) ?? "";
    if (!text || text.replace(/\s+/g, " ").trim() === typed.replace(/\s+/g, " ").trim()) continue;
    suggestions.push({ field, text, drops: droppedFacts(typed, [text]) });
  }
  return { suggestions, rejected };
}

// ─── Goal check (in code) ──────────────────────────────────────────────────

const GOAL_STOP = new Set([
  "would",
  "like",
  "work",
  "goal",
  "skill",
  "with",
  "from",
  "that",
  "this",
  "have",
  "were",
  "will",
  "they",
  "their",
  "them",
  "then",
  "than",
  "into",
  "when",
  "what",
  "also",
  "been",
  "each",
  "more",
  "some",
  "very",
  "about",
  "after",
  "before",
  "during",
  "while",
  "there",
  "which",
  "could",
  "should",
  "staff",
  "support",
  "help",
  "continue",
  "person",
  "week",
  "time",
  "she",
  "her",
  "his",
  "him",
  "the",
  "and",
]);

/** A rough stem: "painting", "painted", "paints" -> "paint". */
export function stem(raw: string): string {
  let w = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && /([^aeiou])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

const stems = (text: string, ignore: ReadonlySet<string>) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !GOAL_STOP.has(w) && !ignore.has(w))
      .map(stem)
      .filter((w) => w.length >= 3 && !GOAL_STOP.has(w)),
  );

/** Words that mean the same general area. Compared by stem. */
const AREA_WORDS: readonly (readonly string[])[] = [
  [
    "talent",
    "music",
    "musical",
    "art",
    "artist",
    "paint",
    "ukulele",
    "piano",
    "instrument",
    "sing",
    "song",
    "draw",
    "guitar",
    "drum",
    "band",
    "craft",
    "creative",
  ],
  [
    "independent",
    "living",
    "cook",
    "meal",
    "laundry",
    "clean",
    "budget",
    "shop",
    "grocery",
    "kitchen",
    "chore",
    "money",
    "bill",
    "bank",
    "apartment",
    "recipe",
  ],
];
const AREAS = AREA_WORDS.map((g) => new Set(g.map(stem)));

const areasOf = (words: ReadonlySet<string>) =>
  AREAS.map((a, i) => ({ a, i })).filter(({ a }) => [...words].some((w) => a.has(w)));

export interface ReviewGoal {
  id: string;
  goal: string;
  supports?: ReadonlyArray<{ support: string; details?: string | null }>;
}

/**
 * Whether a goal's progress text is about the goal: it shares at least one
 * meaningful word or stem with the goal text or its supports, or both fall
 * in the same synonym area (painting or ukulele under a piano goal is
 * fine). `ignore` holds words to skip, such as the person's first name.
 */
export function goalCovered(
  progress: string,
  goal: ReviewGoal,
  ignore: readonly string[] = [],
): boolean {
  const skip = new Set(ignore.map((w) => w.toLowerCase()).filter(Boolean));
  const mine = stems(progress, skip);
  if (!mine.size) return true; // nothing written: not this check's business
  const about = stems(
    [goal.goal, ...(goal.supports ?? []).flatMap((s) => [s.support, s.details ?? ""])].join(" "),
    skip,
  );
  for (const w of mine) if (about.has(w)) return true;
  const theirAreas = new Set(areasOf(about).map((x) => x.i));
  return areasOf(mine).some((x) => theirAreas.has(x.i));
}

// ─── Reminders (fixed wording) ─────────────────────────────────────────────

export interface ReviewContext {
  serviceCodes: readonly string[];
  summaryKind: string;
  includeGoalProgress: boolean;
  goals: readonly ReviewGoal[];
  /** The person's first name, left out of the goal word match. */
  firstName?: string;
}

export type ReminderKind = "no_progress" | "off_area" | "response" | "events";

export interface Reminder {
  /** Stable, so a dismissed reminder stays hidden. */
  key: string;
  kind: ReminderKind;
  field: FieldKey;
  text: string;
}

const RESPONSE_RE =
  /\b(respon\w*|react\w*|enjoy\w*|engag\w*|mood|participat\w*|receptive|happy|happier|excited|upset|anxious|calm|proud|motivat\w*|comfortable|positive|interest\w*|tolerat\w*|welcom\w*|resist\w*|refus\w*|eager|willing|cooperat\w*|smil\w*|laugh\w*|did well|doing well|does well|thriv\w*|stable|status)\b/i;
const EVENTS_RE =
  /\b(incident\w*|event\w*|trip\w*|vacation|holiday\w*|moved|moving|hospital\w*|appointment\w*|birthday|party|graduat\w*|celebrat\w*|concert|visit\w*|outing\w*|attended|went|fair|show|injur\w*|illness|sick|surgery|new job|hired|started|began|completed|sold|won|met|family|camp|fell|emergency|nothing notable|no notable|none)\b/i;

export const mentionsResponse = (text: string) => RESPONSE_RE.test(text);
export const mentionsEvents = (text: string) => EVENTS_RE.test(text);

const narrativeGoals = (ctx: ReviewContext) =>
  ctx.summaryKind === "narrative" && ctx.includeGoalProgress ? ctx.goals : [];

/** Goals with no progress text yet. Finalize asks before going on, never blocks. */
export function blankGoals(ctx: ReviewContext, editor: SummaryEditorState): ReviewGoal[] {
  return narrativeGoals(ctx).filter((g) => !(editor.goals[g.id] ?? "").trim());
}

/** Goals with progress text that shares nothing with the goal: the only ones put to Nectar. */
export function goalsNeedingAreaCheck(ctx: ReviewContext, editor: SummaryEditorState): ReviewGoal[] {
  return narrativeGoals(ctx).filter((g) => {
    const text = (editor.goals[g.id] ?? "").trim();
    return !!text && !goalCovered(text, g, ctx.firstName ? [ctx.firstName] : []);
  });
}

/**
 * The reminders to show: max one per goal, max two for the general notes,
 * minus the ones dismissed. Never required, never recorded as who / when.
 */
export function summaryReminders(
  ctx: ReviewContext,
  editor: SummaryEditorState,
  review: SummaryReviewState,
): Reminder[] {
  if (ctx.summaryKind !== "narrative") return [];
  const out: Reminder[] = [];
  const needArea = new Set(goalsNeedingAreaCheck(ctx, editor).map((g) => g.id));
  for (const g of narrativeGoals(ctx)) {
    const text = (editor.goals[g.id] ?? "").trim();
    if (!text) {
      out.push({
        key: `rem:no_progress:${g.id}`,
        kind: "no_progress",
        field: goalField(g.id),
        text: `No progress written for ${g.goal} yet.`,
      });
    } else if (needArea.has(g.id) && review.offArea[g.id] === text) {
      out.push({
        key: `rem:off_area:${g.id}`,
        kind: "off_area",
        field: goalField(g.id),
        text: `What's written for ${g.goal} may be about a different area. Check it is under the right goal.`,
      });
    }
  }
  const reqs = summaryRequirements(ctx.serviceCodes);
  const wants = (id: string) => reqs.items.some((r) => r.id === id);
  const anyTyped =
    !!(editor.general.trim() || editor.incidentNotes.trim()) ||
    Object.values(editor.goals).some((t) => t.trim());
  if (anyTyped) {
    if (wants("status_response") && !mentionsResponse(editor.general)) {
      out.push({
        key: "rem:response",
        kind: "response",
        field: "general",
        text: "General notes say nothing yet about how the person responded to services.",
      });
    }
    const hasIncidents = !!editor.incidentNotes.trim() || editor.incidents.length > 0;
    if (wants("notable_events") && !mentionsEvents(editor.general) && !hasIncidents) {
      out.push({
        key: "rem:events",
        kind: "events",
        field: "general",
        text: "General notes say nothing yet about notable events.",
      });
    }
  }
  return out.filter((r) => !review.dismissed.includes(r.key));
}

// ─── Review state (draft_source.review) ────────────────────────────────────

export interface SummaryReviewState {
  reviewedAt: string | null;
  /** Nectar's rewrites waiting for Accept or x, one per box. */
  suggestions: FieldSuggestion[];
  /** Reminder and suggestion keys hidden with the x. Hides only; blocks nothing. */
  dismissed: string[];
  /** Goals Nectar answered "no" to (goal id -> the progress text it was asked about). */
  offArea: Record<string, string>;
}

export function emptyReviewState(): SummaryReviewState {
  return { reviewedAt: null, suggestions: [], dismissed: [], offArea: {} };
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * The saved review state, normalized; empty when there is none. Older
 * saves (findings, "Keep as is" records, linked suggestions) load fine:
 * what no longer applies is ignored.
 */
export function readReviewState(raw: unknown): SummaryReviewState {
  const r = obj(raw);
  const suggestions = (Array.isArray(r.suggestions) ? r.suggestions : [])
    .map(obj)
    .filter((s) => typeof s.field === "string" && typeof s.text === "string")
    .map((s) => ({
      field: s.field as FieldKey,
      text: s.text as string,
      drops: Array.isArray(s.drops) ? s.drops.map(String) : [],
    }));
  const offArea: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(r.offArea))) if (typeof v === "string") offArea[k] = v;
  return {
    reviewedAt: strOrNull(r.reviewedAt),
    suggestions,
    dismissed: [
      ...new Set((Array.isArray(r.dismissed) ? r.dismissed : []).filter((k) => typeof k === "string")),
    ] as string[],
    offArea,
  };
}

/** A key for one suggestion card: the box plus a short hash of the text, so a new draft shows again. */
export function suggestionKey(s: Pick<FieldSuggestion, "field" | "text">): string {
  let h = 5381;
  for (let i = 0; i < s.text.length; i++) h = ((h * 33) ^ s.text.charCodeAt(i)) >>> 0;
  return `sug:${s.field}:${h.toString(36)}`;
}

/** The suggestion to show on a box: not dismissed with the x. */
export function visibleSuggestion(
  review: SummaryReviewState,
  field: FieldKey,
): FieldSuggestion | null {
  const s = review.suggestions.find((x) => x.field === field);
  return s && !review.dismissed.includes(suggestionKey(s)) ? s : null;
}

/** The review with one reminder or suggestion key hidden for this summary. */
export function dismissKey(review: SummaryReviewState, key: string): SummaryReviewState {
  return review.dismissed.includes(key)
    ? review
    : { ...review, dismissed: [...review.dismissed, key] };
}

/** The review without the suggestion for `field` (after Accept). */
export function takeSuggestion(review: SummaryReviewState, field: FieldKey): SummaryReviewState {
  return { ...review, suggestions: review.suggestions.filter((s) => s.field !== field) };
}

// ─── Accept and Undo ───────────────────────────────────────────────────────

/** What a box held before Accept: its text and the Nectar mark it carried. */
export interface UndoEntry {
  text: string;
  nectar: string;
}

export type UndoStacks = Partial<Record<FieldKey, UndoEntry[]>>;

function nectarMark(editor: SummaryEditorState, field: FieldKey): string {
  if (field === "general") return editor.nectar.general;
  if (field === "incidentNotes") return editor.nectar.incidentNotes;
  const id = fieldGoalId(field);
  return id === null ? "" : (editor.nectar.goals[id] ?? "");
}

function writeField(
  editor: SummaryEditorState,
  field: FieldKey,
  text: string,
  mark: string,
): SummaryEditorState {
  if (field === "general") return { ...editor, general: text, nectar: { ...editor.nectar, general: mark } };
  if (field === "incidentNotes") {
    return { ...editor, incidentNotes: text, nectar: { ...editor.nectar, incidentNotes: mark } };
  }
  const id = fieldGoalId(field);
  if (id === null) return editor;
  return {
    ...editor,
    goals: { ...editor.goals, [id]: text },
    nectar: { ...editor.nectar, goals: { ...editor.nectar.goals, [id]: mark } },
  };
}

/**
 * Accept a suggestion: the box takes Nectar's text (marked as Nectar's
 * until Finalize). Returns what to put on the box's undo stack. Refused
 * when the rewrite drops something the person wrote.
 */
export function acceptSuggestion(
  editor: SummaryEditorState,
  suggestion: FieldSuggestion,
): { editor: SummaryEditorState; undo: UndoEntry } {
  if (suggestion.drops.length) {
    throw new Error("This rewrite drops something you wrote. Copy what you want instead.");
  }
  const undo = { text: fieldText(editor, suggestion.field), nectar: nectarMark(editor, suggestion.field) };
  return { editor: writeField(editor, suggestion.field, suggestion.text, suggestion.text), undo };
}

export function pushUndo(stacks: UndoStacks, field: FieldKey, entry: UndoEntry): UndoStacks {
  return { ...stacks, [field]: [...(stacks[field] ?? []), entry] };
}

/** Undo the last Accept on a box: exactly the text it had before. */
export function undoAccept(
  editor: SummaryEditorState,
  stacks: UndoStacks,
  field: FieldKey,
): { editor: SummaryEditorState; stacks: UndoStacks } {
  const list = stacks[field] ?? [];
  const entry = list[list.length - 1];
  if (!entry) return { editor, stacks };
  return {
    editor: writeField(editor, field, entry.text, entry.nectar),
    stacks: { ...stacks, [field]: list.slice(0, -1) },
  };
}
