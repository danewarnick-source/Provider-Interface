// Reviewing a progress summary the way a clock-out shift note is reviewed:
// findings next to the field they are about, each one fixed (it clears on
// the next check) or kept on purpose ("Keep as is", recorded with who and
// when), and Finalize blocked while any is open.
//
// This module is the pure part:
//   - the checks that need no AI (summaryChecks): goals with no progress,
//     required contents that are missing (progress-summary-requirements.ts),
//     and dates outside the period (findDates);
//   - the guards on Nectar's suggested rewrites: every date and number in a
//     rewrite must come from the typed text or the period's records
//     (unsupportedFacts), the person's own dates and numbers must survive
//     (droppedFacts), sentences are never repeated (dedupeFields), and a
//     field whose text moved into other fields is accepted together with
//     them (linkSuggestions);
//   - the review state saved in client_progress_summaries.draft_source.review
//     and the Finalize gate (openFindings).
// Node --test.

import { formatDate } from "./clients/dates.ts";
import type { SummaryEditorState } from "./progress-summary-doc.ts";
import { summaryRequirements } from "./progress-summary-requirements.ts";

// ─── Fields ────────────────────────────────────────────────────────────────

/** A place in the editor a finding or a suggestion is about. */
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

function setFieldText(
  editor: SummaryEditorState,
  field: FieldKey,
  text: string,
): SummaryEditorState {
  if (field === "general") {
    return { ...editor, general: text, nectar: { ...editor.nectar, general: text } };
  }
  if (field === "incidentNotes") {
    return { ...editor, incidentNotes: text, nectar: { ...editor.nectar, incidentNotes: text } };
  }
  const goalId = fieldGoalId(field);
  if (goalId === null) return editor;
  return {
    ...editor,
    goals: { ...editor.goals, [goalId]: text },
    nectar: { ...editor.nectar, goals: { ...editor.nectar.goals, [goalId]: text } },
  };
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

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * The days a written date can mean, as ISO strings. With no year it takes
 * the period's year (the end year when only that one puts it in the period).
 */
export function dateSpan(
  d: FoundDate,
  periodStart: string,
  periodEnd: string,
): { from: string; to: string } {
  const span = (y: number) => ({
    from: `${y}-${pad2(d.month)}-${pad2(d.day ?? 1)}`,
    to: `${y}-${pad2(d.month)}-${pad2(d.day ?? lastDay(y, d.month))}`,
  });
  if (d.year !== null) return span(d.year);
  const years = [...new Set([+periodStart.slice(0, 4), +periodEnd.slice(0, 4)])];
  for (const y of years) {
    const s = span(y);
    if (s.to >= periodStart && s.from <= periodEnd) return s;
  }
  return span(years[0]);
}

/** Dates in `text` that fall wholly outside periodStart…periodEnd. */
export function datesOutsidePeriod(
  text: string,
  periodStart: string,
  periodEnd: string,
): FoundDate[] {
  return findDates(text).filter((d) => {
    const s = dateSpan(d, periodStart, periodEnd);
    return s.to < periodStart || s.from > periodEnd;
  });
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

const STOP = new Set([
  "that",
  "this",
  "with",
  "from",
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
  "being",
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
  "would",
  "could",
  "should",
]);
const contentWords = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );

/** Share of a sentence's content words that `text` contains (1 when it has none). */
function coverage(sentence: string, text: string): number {
  const words = contentWords(sentence);
  if (!words.size) return 1;
  const have = contentWords(text);
  let n = 0;
  for (const w of words) if (have.has(w)) n++;
  return n / words.size;
}

const COVERED = 0.6;

// ─── Suggestions ───────────────────────────────────────────────────────────

/** Nectar's rewrite of one field, offered as Accept / Keep mine. */
export interface FieldSuggestion {
  field: FieldKey;
  text: string;
  /** Dates / numbers the person typed that this rewrite (with the others) loses. No one-click accept when set. */
  drops: string[];
  /** Fields that received this field's text; accepted together with it. */
  linked: FieldKey[];
}

/**
 * Which other suggestions took something out of each field: a date or
 * number, or a sentence, the field's own suggestion no longer has but
 * another suggestion does.
 */
export function linkSuggestions(
  typed: ReadonlyMap<FieldKey, string>,
  proposed: ReadonlyMap<FieldKey, string>,
): Map<FieldKey, FieldKey[]> {
  const out = new Map<FieldKey, FieldKey[]>();
  for (const [field, text] of proposed) {
    const before = typed.get(field) ?? "";
    const own = factTokens(text, true);
    const lostFacts = [...factTokens(before).keys()].filter((k) => !own.has(k));
    const lostSentences = before
      .split("\n")
      .flatMap(splitSentences)
      .filter((s) => coverage(s, text) < COVERED);
    const links: FieldKey[] = [];
    for (const [other, otherText] of proposed) {
      if (other === field) continue;
      const theirs = factTokens(otherText, true);
      if (
        lostFacts.some((k) => theirs.has(k)) ||
        lostSentences.some((s) => coverage(s, otherText) >= COVERED)
      ) {
        links.push(other);
      }
    }
    out.set(field, links);
  }
  return out;
}

export interface SuggestionInput {
  /** The text each field holds now. */
  current: ReadonlyMap<FieldKey, string>;
  /** Nectar's text per field (only the fields it rewrote). */
  proposed: ReadonlyMap<FieldKey, string>;
  /** The period's records, goal and support text: where a rewrite's dates and numbers may come from. */
  records: readonly string[];
  /** Field order for dedupe (goals first). */
  order: readonly FieldKey[];
}

export interface SuggestionResult {
  suggestions: FieldSuggestion[];
  /** Fields whose rewrite was dropped, with the dates / numbers it made up. */
  rejected: { field: FieldKey; facts: string[] }[];
}

/**
 * Nectar's rewrites made safe to offer: a rewrite with a date or number
 * that is in neither the typed text nor the records is dropped; repeated
 * sentences are removed; a rewrite equal to the field is not offered; each
 * suggestion lists what the person typed that would be lost (drops) and the
 * fields that took its text (linked).
 */
export function buildSuggestions(input: SuggestionInput): SuggestionResult {
  const typedAll = [...input.current.values()];
  const rejected: SuggestionResult["rejected"] = [];
  const valid = new Map<FieldKey, string>();
  for (const [field, raw] of input.proposed) {
    const text = String(raw ?? "").trim();
    if (!text || !input.current.has(field)) continue;
    const facts = unsupportedFacts(text, [...typedAll, ...input.records]);
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
  const proposed = new Map<FieldKey, string>();
  for (const f of valid.keys()) {
    const t = deduped.get(f) ?? "";
    if (
      t.replace(/\s+/g, " ").trim() !== (input.current.get(f) ?? "").replace(/\s+/g, " ").trim()
    ) {
      proposed.set(f, t);
    }
  }
  const after = [...input.order].map((f) =>
    proposed.has(f) ? proposed.get(f)! : (input.current.get(f) ?? ""),
  );
  const links = linkSuggestions(input.current, proposed);
  const suggestions: FieldSuggestion[] = [...proposed].map(([field, text]) => ({
    field,
    text,
    drops: droppedFacts(input.current.get(field) ?? "", after),
    linked: links.get(field) ?? [],
  }));
  return { suggestions, rejected };
}

// ─── Findings ──────────────────────────────────────────────────────────────

export type FindingKind =
  | "missing_progress"
  | "missing_required"
  | "out_of_period"
  | "misplaced"
  | "off_goal"
  | "vague";

export const FINDING_KINDS: readonly FindingKind[] = [
  "missing_progress",
  "missing_required",
  "out_of_period",
  "misplaced",
  "off_goal",
  "vague",
];

export interface SummaryFinding {
  /** Stable across re-checks, so a "Keep as is" sticks to the same finding. */
  key: string;
  field: FieldKey;
  kind: FindingKind;
  message: string;
  suggestion?: string;
  /** The words in the field the finding is about; once they are gone the finding is fixed. */
  quote?: string;
  /** Goal id the text belongs under ("Move to <goal>"). */
  moveTo?: string;
  cite?: string;
  source: "check" | "nectar";
  /** Missing required content: "Keep as is" needs a short reason. */
  needsReason: boolean;
  /** About a pending suggestion's text, not the field as typed; applies once the suggestion is accepted. */
  onSuggestion?: boolean;
}

export interface ReviewContext {
  periodStart: string;
  periodEnd: string;
  serviceCodes: readonly string[];
  summaryKind: string;
  includeGoalProgress: boolean;
  goals: ReadonlyArray<{ id: string; goal: string }>;
}

const periodText = (ctx: Pick<ReviewContext, "periodStart" | "periodEnd">) =>
  `${formatDate(ctx.periodStart, { month: "short", day: "numeric" })} – ${formatDate(ctx.periodEnd)}`;

/** The checks that need no AI, on the editor as it is now. */
export function summaryChecks(ctx: ReviewContext, editor: SummaryEditorState): SummaryFinding[] {
  if (ctx.summaryKind !== "narrative") return [];
  const out: SummaryFinding[] = [];
  const reqs = summaryRequirements(ctx.serviceCodes);
  const goalReq = reqs.items.find((r) => r.id === "goal_progress");
  const goals = ctx.includeGoalProgress ? ctx.goals : [];

  if (goalReq && ctx.includeGoalProgress) {
    if (!goals.length) {
      out.push({
        key: "check:no_goals",
        field: "general",
        kind: "missing_progress",
        message: "No plan goals on file. The summary must show progress toward each goal.",
        cite: goalReq.cite,
        source: "check",
        needsReason: true,
      });
    }
    for (const g of goals) {
      if ((editor.goals[g.id] ?? "").trim()) continue;
      out.push({
        key: `check:missing_progress:${g.id}`,
        field: goalField(g.id),
        kind: "missing_progress",
        message: "No progress written for this goal.",
        cite: goalReq.cite,
        source: "check",
        needsReason: true,
      });
    }
  }

  const generalReqs = reqs.items.filter((r) => r.source === "general");
  if (generalReqs.length && !editor.general.trim()) {
    out.push({
      key: "check:missing_required:general",
      field: "general",
      kind: "missing_required",
      message: `General notes are empty. Required: ${generalReqs.map((r) => r.label.toLowerCase()).join("; ")}.`,
      cite: [...new Set(generalReqs.map((r) => r.cite))].join("; "),
      source: "check",
      needsReason: true,
    });
  }
  const allText = [
    editor.general,
    editor.incidentNotes,
    ...goals.map((g) => editor.goals[g.id] ?? ""),
  ].join("\n");
  for (const r of reqs.items) {
    if (!r.detect || r.detect.test(allText)) continue;
    out.push({
      key: `check:missing_required:${r.id}`,
      field: "general",
      kind: "missing_required",
      message: `Not found: ${r.label.toLowerCase()}.`,
      cite: r.cite,
      source: "check",
      needsReason: true,
    });
  }

  for (const field of textFields(goals.map((g) => g.id))) {
    const seen = new Set<string>();
    for (const d of datesOutsidePeriod(fieldText(editor, field), ctx.periodStart, ctx.periodEnd)) {
      const k = d.raw.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        key: `check:out_of_period:${field}:${k}`,
        field,
        kind: "out_of_period",
        message: `"${d.raw}" is outside this period (${periodText(ctx)}).`,
        suggestion: "Take it out, or keep it if it explains this period.",
        quote: d.raw,
        source: "check",
        needsReason: false,
      });
    }
  }
  for (const m of editor.incidents) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) continue;
    if (m.date >= ctx.periodStart && m.date <= ctx.periodEnd) continue;
    out.push({
      key: `check:out_of_period:incident:${m.id}:${m.date}`,
      field: `incident:${m.id}`,
      kind: "out_of_period",
      message: `This incident's date (${formatDate(m.date)}) is outside this period (${periodText(ctx)}).`,
      source: "check",
      needsReason: false,
    });
  }
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const slug = (s: string) =>
  squash(s)
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80);

/**
 * Nectar's findings, kept only where they make sense: a known field and
 * kind, a goal id that exists, a quote that is really in the field (else
 * the finding is about the whole field), and no repeat of a date the
 * checks already flag.
 */
export function cleanNectarFindings(
  raw: unknown,
  fields: ReadonlyMap<FieldKey, string>,
  goalIds: ReadonlySet<string>,
  cites: ReadonlyMap<string, string> = new Map(),
): SummaryFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: SummaryFinding[] = [];
  const keys = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const field = String(r.field ?? "") as FieldKey;
    const kind = String(r.kind ?? "") as FindingKind;
    const message = typeof r.message === "string" ? r.message.trim().slice(0, 400) : "";
    if (!fields.has(field) || !FINDING_KINDS.includes(kind) || !message) continue;
    if (kind === "missing_progress") continue; // the checks own this one
    let quote = typeof r.quote === "string" ? r.quote.trim().slice(0, 300) : "";
    if (quote && !squash(fields.get(field) ?? "").includes(squash(quote))) quote = "";
    if (kind === "out_of_period" && quote && findDates(quote).length) continue;
    const moveTo = typeof r.moveTo === "string" && goalIds.has(r.moveTo) ? r.moveTo : undefined;
    if (moveTo && field === goalField(moveTo)) continue;
    const requirement = typeof r.requirement === "string" ? r.requirement : "";
    const suggestion = typeof r.suggestion === "string" ? r.suggestion.trim().slice(0, 400) : "";
    const key = `nectar:${kind}:${field}:${slug(quote || requirement || message)}`;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push({
      key,
      field,
      kind,
      message,
      ...(suggestion ? { suggestion } : {}),
      ...(quote ? { quote } : {}),
      ...(moveTo ? { moveTo } : {}),
      ...(cites.get(requirement) ? { cite: cites.get(requirement) } : {}),
      source: "nectar",
      needsReason: false,
    });
  }
  return out;
}

// ─── Review state (draft_source.review) ────────────────────────────────────

export interface Dismissal {
  by: string;
  byName: string | null;
  at: string;
  reason: string | null;
}

export interface SummaryReviewState {
  mode: "draft" | "review" | null;
  reviewedAt: string | null;
  /** Nectar's findings from the last run (the checks are recomputed live). */
  findings: SummaryFinding[];
  suggestions: FieldSuggestion[];
  /** "Keep as is" by finding key. */
  dismissals: Record<string, Dismissal>;
}

export function emptyReviewState(): SummaryReviewState {
  return { mode: null, reviewedAt: null, findings: [], suggestions: [], dismissals: {} };
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** The saved review state, normalized; empty when there is none. */
export function readReviewState(raw: unknown): SummaryReviewState {
  const r = obj(raw);
  const findings = (Array.isArray(r.findings) ? r.findings : [])
    .map(obj)
    .filter(
      (f) =>
        typeof f.key === "string" &&
        typeof f.field === "string" &&
        FINDING_KINDS.includes(f.kind as FindingKind) &&
        typeof f.message === "string",
    ) as unknown as SummaryFinding[];
  const suggestions = (Array.isArray(r.suggestions) ? r.suggestions : [])
    .map(obj)
    .filter((s) => typeof s.field === "string" && typeof s.text === "string")
    .map((s) => ({
      field: s.field as FieldKey,
      text: s.text as string,
      drops: Array.isArray(s.drops) ? s.drops.map(String) : [],
      linked: (Array.isArray(s.linked) ? s.linked.map(String) : []) as FieldKey[],
    }));
  const dismissals: Record<string, Dismissal> = {};
  for (const [k, v] of Object.entries(obj(r.dismissals))) {
    const d = obj(v);
    if (typeof d.by !== "string" || typeof d.at !== "string") continue;
    dismissals[k] = {
      by: d.by,
      at: d.at,
      byName: strOrNull(d.byName),
      reason: strOrNull(d.reason),
    };
  }
  return {
    mode: r.mode === "draft" || r.mode === "review" ? r.mode : null,
    reviewedAt: strOrNull(r.reviewedAt),
    findings,
    suggestions,
    dismissals,
  };
}

/** Nectar findings that still apply: not waiting on a suggestion, and their quoted words still in the field. */
export function liveNectarFindings(
  review: SummaryReviewState,
  editor: SummaryEditorState,
): SummaryFinding[] {
  return review.findings.filter(
    (f) =>
      !f.onSuggestion && (!f.quote || squash(fieldText(editor, f.field)).includes(squash(f.quote))),
  );
}

/** What blocks Finalize: every check and live Nectar finding not kept with "Keep as is". */
export function openFindings(
  checks: readonly SummaryFinding[],
  review: SummaryReviewState,
  editor: SummaryEditorState,
): SummaryFinding[] {
  return [...checks, ...liveNectarFindings(review, editor)].filter(
    (f) => !review.dismissals[f.key],
  );
}

/** What blocks Finalize for the editor as it is: the checks plus the saved review. */
export function finalizeBlockers(
  ctx: ReviewContext,
  editor: SummaryEditorState,
  review: SummaryReviewState,
): SummaryFinding[] {
  return openFindings(summaryChecks(ctx, editor), review, editor);
}

/** Missing required content (a check, never Nectar): "Keep as is" needs a reason. Read from the key alone. */
export function findingNeedsReason(key: string): boolean {
  return /^check:(missing_|no_goals)/.test(key);
}

export const MIN_DISMISS_REASON = 5;

/** Whether "Keep as is" may be recorded for `finding` with `reason`. */
export function canDismiss(
  finding: Pick<SummaryFinding, "needsReason">,
  reason: string | null | undefined,
): boolean {
  return !finding.needsReason || (reason ?? "").trim().length >= MIN_DISMISS_REASON;
}

/** The review with "Keep as is" recorded for one finding. */
export function dismissFinding(
  review: SummaryReviewState,
  finding: Pick<SummaryFinding, "key" | "needsReason">,
  who: { by: string; byName: string | null; at: string },
  reason: string | null,
): SummaryReviewState {
  if (!canDismiss(finding, reason)) throw new Error("Give a short reason to keep this as is.");
  return {
    ...review,
    dismissals: {
      ...review.dismissals,
      [finding.key]: { ...who, reason: reason?.trim() ? reason.trim().slice(0, 500) : null },
    },
  };
}

/** `field` plus every suggestion linked from it, transitively. */
export function suggestionGroup(review: SummaryReviewState, field: FieldKey): FieldKey[] {
  const byField = new Map(review.suggestions.map((s) => [s.field, s]));
  const out: FieldKey[] = [];
  const queue = [field];
  while (queue.length) {
    const f = queue.shift()!;
    if (out.includes(f) || !byField.has(f)) continue;
    out.push(f);
    queue.push(...byField.get(f)!.linked);
  }
  return out;
}

/**
 * Accept a suggestion (and the ones it is linked to): the fields take
 * Nectar's text, marked as Nectar's until Finalize, and the findings Nectar
 * made on that text start to apply. Refused when one of them drops
 * something the person wrote.
 */
export function acceptSuggestion(
  editor: SummaryEditorState,
  review: SummaryReviewState,
  field: FieldKey,
): { editor: SummaryEditorState; review: SummaryReviewState; accepted: FieldKey[] } {
  const group = suggestionGroup(review, field);
  if (!group.length) return { editor, review, accepted: [] };
  const list = review.suggestions.filter((s) => group.includes(s.field));
  if (list.some((s) => s.drops.length)) {
    throw new Error("This rewrite drops something you wrote. Copy what you want instead.");
  }
  let next = editor;
  for (const s of list) next = setFieldText(next, s.field, s.text);
  return {
    editor: next,
    review: {
      ...review,
      suggestions: review.suggestions.filter((s) => !group.includes(s.field)),
      findings: review.findings.map((f) =>
        f.onSuggestion && group.includes(f.field) ? { ...f, onSuggestion: false } : f,
      ),
    },
    accepted: group,
  };
}

/** "Keep mine": drop the suggestion for `field` and Nectar's findings on its text. */
export function keepMine(review: SummaryReviewState, field: FieldKey): SummaryReviewState {
  return {
    ...review,
    suggestions: review.suggestions.filter((s) => s.field !== field),
    findings: review.findings.filter((f) => !(f.onSuggestion && f.field === field)),
  };
}
