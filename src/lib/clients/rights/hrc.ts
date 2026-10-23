// Rights restrictions (HRR: human rights restriction / rights modification).
// The one place for what the contract requires of an HRR: its questions, its
// informed consent and signatures, when it counts as done, and how Nectar's
// draft from an uploaded HRR document is checked. Pure (no Supabase, no
// React), node --test.
//
// Contract: DHHS91172 SOW (docs/compliance/dhhs91172/Requirements.json).

import { normalizeForMatch } from "../strategies/strategies-pull.ts";

/** What the contract says about rights restrictions, with the SOW cite. */
export const HRR_RULES = [
  {
    cite: "SOW 1.20(b)",
    rule: "The Human Rights Committee decides and documents approval or denial of each rights modification. The process must be person-centered.",
  },
  {
    cite: "SOW 1.20(b)(1)-(8)",
    rule: "The documentation includes: the assessed need, positive supports used first, less intrusive methods tried, a clear description in proportion to the need, data collection and review, time limits for review, informed consent, and a no-harm assurance.",
  },
  { cite: "SOW 1.20(b)(7)", rule: "Informed consent of the person." },
  { cite: "SOW 1.10(10)", rule: "Human Rights Committee documentation is kept in the client file." },
  {
    cite: "SOW 1.21(6)",
    rule: "The person may ask the Human Rights Committee to review their supports or services.",
  },
  {
    cite: "SOW 1.28(2), 1.28(6)",
    rule: "Limits on a person's funds need Human Rights Committee approval, and written approval from the support coordinator before they start.",
  },
  {
    cite: "SOW 1.29(1)",
    rule: "Kitchen privileges may only be limited with Human Rights Committee approval, in the person's health interest.",
  },
  {
    cite: "SOW 1.33(2)",
    rule: "When the DSPD Worksheet documents 2:1 staffing, a rights modification must be approved.",
  },
  {
    cite: "SOW 3.4(3), 4.4(3), 5.4(3)",
    rule: "Rights modifications to settings requirements follow Utah Admin. Code R414-519-2, 8(g).",
  },
] as const;

export type RestrictionRecord = {
  id: string;
  organization_id: string;
  client_id: string;
  restriction_title: string;
  active: boolean;
  assessed_need_text: string | null;
  positive_interventions_text: string | null;
  less_intrusive_methods_text: string | null;
  condition_description_text: string | null;
  data_review_text: string | null;
  last_review_date: string | null;
  time_limits_text: string | null;
  next_review_date: string | null;
  restore_plan_text: string | null;
  no_harm_text: string | null;
  document_id: string | null;
  nectar_fields: string[] | null;
  consent_signer_name: string | null;
  consent_signer_role: string | null;
  consent_client_name: string | null;
  consent_by: string | null;
  consent_at: string | null;
  admin_signer_name: string | null;
  admin_signed_by: string | null;
  admin_signed_at: string | null;
  sc_name: string | null;
  sc_signed_on: string | null;
  sc_method: string | null;
  sc_recorded_by: string | null;
  sc_recorded_at: string | null;
  hrc_decision: string | null;
  hrc_decision_on: string | null;
  hrc_recorded_by: string | null;
  hrc_recorded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HrrTextField =
  | "condition_description_text"
  | "assessed_need_text"
  | "positive_interventions_text"
  | "less_intrusive_methods_text"
  | "data_review_text"
  | "time_limits_text"
  | "restore_plan_text"
  | "no_harm_text";
export type HrrDateField = "last_review_date" | "next_review_date";
export type HrrField = HrrTextField | HrrDateField;

export type HrrQuestion = {
  field: HrrTextField;
  label: string;
  help: string;
  /** SOW cite, or null when the contract doesn't require it. */
  cite: string | null;
  required: boolean;
  date: { field: HrrDateField; label: string } | null;
};

/** The HRR form's questions, in order. Informed consent comes after all of them. */
export const HRR_QUESTIONS: readonly HrrQuestion[] = [
  {
    field: "condition_description_text",
    label: "The restriction",
    help: "Which right is limited, and how. Keep it in proportion to the need.",
    cite: "SOW 1.20(b)(4)",
    required: true,
    date: null,
  },
  {
    field: "assessed_need_text",
    label: "Reason (the assessed need)",
    help: "The specific, individual need this restriction meets.",
    cite: "SOW 1.20(b)(1)",
    required: true,
    date: null,
  },
  {
    field: "positive_interventions_text",
    label: "Positive supports used first",
    help: "Positive interventions and supports used before this restriction.",
    cite: "SOW 1.20(b)(2)",
    required: true,
    date: null,
  },
  {
    field: "less_intrusive_methods_text",
    label: "Less restrictive options tried",
    help: "Less intrusive ways of meeting the need that were tried and did not work.",
    cite: "SOW 1.20(b)(3)",
    required: true,
    date: null,
  },
  {
    field: "data_review_text",
    label: "Data collection and review",
    help: "What data is collected, and how often it is reviewed to see if this still works.",
    cite: "SOW 1.20(b)(5)",
    required: true,
    date: { field: "last_review_date", label: "Date of last review" },
  },
  {
    field: "time_limits_text",
    label: "Time limits and review",
    help: "How often it is reviewed to decide if it is still needed or can end.",
    cite: "SOW 1.20(b)(6)",
    required: true,
    date: { field: "next_review_date", label: "Next review date" },
  },
  {
    field: "restore_plan_text",
    label: "Plan to restore the right",
    help: "What needs to happen for the restriction to end.",
    cite: null,
    required: false,
    date: null,
  },
  {
    field: "no_harm_text",
    label: "No-harm assurance",
    help: "How you are sure these supports will cause the person no harm.",
    cite: "SOW 1.20(b)(8)",
    required: true,
    date: null,
  },
];

export const HRR_TEXT_FIELDS: readonly HrrTextField[] = HRR_QUESTIONS.map((q) => q.field);
export const HRR_DATE_FIELDS: readonly HrrDateField[] = HRR_QUESTIONS.flatMap((q) =>
  q.date ? [q.date.field] : [],
);
export const HRR_FIELDS: readonly HrrField[] = [...HRR_TEXT_FIELDS, ...HRR_DATE_FIELDS];

export function isHrrField(v: unknown): v is HrrField {
  return typeof v === "string" && (HRR_FIELDS as readonly string[]).includes(v);
}

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

type Answers = Partial<Record<HrrField, string | null>>;

/** A question is answered when its text (and its date, if it has one) is filled. */
export function isQuestionAnswered(answers: Answers, q: HrrQuestion): boolean {
  return filled(answers[q.field]) && (!q.date || filled(answers[q.date.field]));
}

/** Required questions still blank. */
export function missingQuestions(answers: Answers): HrrQuestion[] {
  return HRR_QUESTIONS.filter((q) => q.required && !isQuestionAnswered(answers, q));
}

// ── Informed consent (SOW 1.20(b)(7)) ─────────────────────────────────────

/** The contract has no consent wording beyond "informed consent of the Person". */
export const CONSENT_CHECKBOX = "I understand this rights restriction and give my informed consent.";

export function consentStatement(clientName: string): string {
  return `This rights restriction for ${clientName} was explained: what it is, why it is needed, what was tried first, and how and when it will be reviewed. ${clientName} can ask the Human Rights Committee to review it at any time.`;
}

export type ConsentRole = "client" | "guardian";
export type ConsentSigner = { role: ConsentRole; label: string; expectedName: string | null };

/**
 * Who types their name for consent. From guardianStatus (guardian.ts): the
 * client when they are their own guardian, otherwise the guardian.
 */
export function consentSigner(
  guardian: { kind: string; guardian?: { name: string } },
  clientName: string,
): ConsentSigner {
  if (guardian.kind === "own") {
    return { role: "client", label: "Client's full name", expectedName: clientName.trim() || null };
  }
  return {
    role: "guardian",
    label: "Guardian's full name",
    expectedName: guardian.guardian?.name?.trim() || null,
  };
}

const nameTokens = (s: string) =>
  s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/['-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

/** The typed name matches the name on file: every word of the name on file is in it (middle names allowed). */
export function nameMatches(typed: string, onFile: string | null): boolean {
  if (!onFile?.trim()) return true;
  const t = new Set(nameTokens(typed));
  const want = nameTokens(onFile);
  return want.length > 0 && want.every((w) => t.has(w));
}

/** Soft warning when the typed consent name doesn't match the name on file (never blocks). */
export function consentNameWarning(typed: string, signer: ConsentSigner): string | null {
  if (!typed.trim() || !signer.expectedName || nameMatches(typed, signer.expectedName)) return null;
  const who = signer.role === "guardian" ? "the guardian" : "the client";
  return `This doesn't match ${who} on file (${signer.expectedName}). Check the spelling.`;
}

// ── Signatures ────────────────────────────────────────────────────────────

export const SC_METHODS = [
  { value: "in_person", label: "In person" },
  { value: "email", label: "By email" },
  { value: "signed_copy", label: "Signed copy uploaded" },
] as const;
export type ScMethod = (typeof SC_METHODS)[number]["value"];

export function scMethodLabel(v: string | null | undefined): string {
  return SC_METHODS.find((m) => m.value === v)?.label ?? "";
}

export type HrrSignerKey = "consent" | "admin" | "sc" | "hrc";
export type HrrSignature = {
  key: HrrSignerKey;
  label: string;
  done: boolean;
  name: string | null;
  /** ISO date or timestamp of the signature / decision. */
  on: string | null;
};

/**
 * Who has and hasn't signed. HRC approval is part of it: the committee
 * approves or denies each rights modification (SOW 1.20(b)).
 */
export function hrrSignatures(r: RestrictionRecord): HrrSignature[] {
  const consentName = r.consent_signer_name?.trim() || null;
  return [
    {
      key: "consent",
      label: r.consent_signer_role === "guardian" ? "Guardian consent" : "Client consent",
      done: !!consentName && !!r.consent_at,
      name: consentName,
      on: r.consent_at,
    },
    {
      key: "admin",
      label: "Provider admin",
      done: filled(r.admin_signer_name) && !!r.admin_signed_at,
      name: r.admin_signer_name?.trim() || null,
      on: r.admin_signed_at,
    },
    {
      key: "sc",
      label: "Support coordinator",
      done: filled(r.sc_name) && !!r.sc_signed_on && !!scMethodLabel(r.sc_method),
      name: r.sc_name?.trim() || null,
      on: r.sc_signed_on,
    },
    {
      key: "hrc",
      label: "Human Rights Committee",
      done: r.hrc_decision === "approved" && !!r.hrc_decision_on,
      name: r.hrc_decision === "approved" ? "Approved" : r.hrc_decision === "denied" ? "Denied" : null,
      on: r.hrc_decision_on,
    },
  ];
}

export type HrrStatus = "draft" | "awaiting_signatures" | "signed" | "denied";

export const HRR_STATUS_LABEL: Record<HrrStatus, string> = {
  draft: "Draft",
  awaiting_signatures: "Awaiting signatures",
  signed: "Signed",
  denied: "Denied by HRC",
};

/**
 * Draft until every required question is answered; then awaiting signatures
 * until consent, provider admin, support coordinator and HRC approval are all
 * in; then signed. A denial by the committee ends it.
 */
export function hrrStatus(r: RestrictionRecord): HrrStatus {
  if (r.hrc_decision === "denied") return "denied";
  if (missingQuestions(r).length) return "draft";
  return hrrSignatures(r).every((s) => s.done) ? "signed" : "awaiting_signatures";
}

/** The one rule for "this HRR is done": fully signed and HRC-approved. */
export function isHrrDone(r: RestrictionRecord): boolean {
  return hrrStatus(r) === "signed";
}

/** Short line for lists: who still has to sign, or the status. */
export function hrrStatusDetail(r: RestrictionRecord): string {
  const status = hrrStatus(r);
  if (status === "draft") {
    const n = missingQuestions(r).length;
    return `${n} question${n === 1 ? "" : "s"} to answer`;
  }
  if (status === "awaiting_signatures") {
    const waiting = hrrSignatures(r).filter((s) => !s.done);
    return `Waiting on: ${waiting.map((s) => s.label.toLowerCase()).join(", ")}`;
  }
  return HRR_STATUS_LABEL[status];
}

// ── Nectar's draft from the uploaded HRR document ────────────────────────

export const HRR_NECTAR_MAX_CHARS = 60_000;
/** Text answers shorter than this can't be shown to come from the document. */
export const HRR_MIN_WORDS = 3;
const MAX_ANSWER = 2000;

export const HRR_NECTAR_SYSTEM = [
  "You are NECTAR, helping a Utah DSPD provider agency move a rights restriction (human rights restriction / rights modification) document into its records.",
  "You are given the text of ONE uploaded document. For each field below, COPY the answer from the document, word for word.",
  "Never reword, summarize, complete or invent anything. If the document doesn't answer a field, leave it out.",
  "Dates: give them as YYYY-MM-DD, and only if that date is written in the document.",
  "Fields:",
  ...HRR_QUESTIONS.flatMap((q) => [
    `- ${q.field}: ${q.label}. ${q.help}`,
    ...(q.date ? [`- ${q.date.field}: ${q.date.label} (YYYY-MM-DD).`] : []),
  ]),
  'Respond ONLY with JSON: { "fields": { "<field>": "<text copied from the document>" } }. No preamble, no markdown fences.',
].join("\n");

export function hrrNectarPrompt(title: string, docText: string): string {
  return `RESTRICTION TITLE: ${title}\n\nDOCUMENT TEXT:\n${docText.slice(0, HRR_NECTAR_MAX_CHARS)}`;
}

const STOP = new Set(
  "a an and are as at be been but by for from has have he her his if in into is it its not of on or our she so that the their them they this to was were will with who".split(
    " ",
  ),
);

/** Normalized words (letters and digits) of a text. */
function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * The answer can be traced to the document: near-verbatim (same words,
 * ignoring case, punctuation and spacing), or by key phrases — almost every
 * content word is in the document and at least one 4-word run is copied.
 */
export function traceableToDocument(answer: string, docText: string): boolean {
  const w = words(answer);
  if (w.length < HRR_MIN_WORDS) return false;
  const doc = normalizeForMatch(docText);
  if (doc.includes(normalizeForMatch(answer))) return true;
  const docWords = new Set(words(docText));
  const content = w.filter((x) => x.length >= 4 && !STOP.has(x));
  if (!content.length) return false;
  const found = content.filter((x) => docWords.has(x)).length;
  if (found / content.length < 0.85) return false;
  for (let i = 0; i + 4 <= w.length; i++) {
    if (doc.includes(w.slice(i, i + 4).join(""))) return true;
  }
  return false;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** A real calendar date as YYYY-MM-DD (from YYYY-MM-DD or M/D/YYYY), else null. */
export function parseHrrDate(v: string): string | null {
  const s = v.trim();
  let y: number, m: number, d: number;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else {
    hit = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (!hit) return null;
    [m, d, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  }
  if (y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The date is written in the document in a common form (ISO, M/D/YYYY, "Month D, YYYY"). */
export function dateInDocument(ymd: string, docText: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const yy = String(y).slice(2);
  const month = MONTHS[m - 1];
  const forms = [
    `${y}-${mm}-${dd}`,
    `${m}/${d}/${y}`,
    `${mm}/${dd}/${y}`,
    `${m}/${d}/${yy}`,
    `${mm}/${dd}/${yy}`,
    `${month} ${d}, ${y}`,
    `${month.slice(0, 3)} ${d}, ${y}`,
    `${d} ${month} ${y}`,
  ];
  const doc = normalizeForMatch(docText);
  // Bounded on both sides by a non-digit, so 1/1/2026 doesn't match 11/12026.
  return forms.some((f) => {
    const key = normalizeForMatch(f);
    let i = doc.indexOf(key);
    while (i >= 0) {
      const before = doc[i - 1] ?? "";
      const after = doc[i + key.length] ?? "";
      if (!/\d/.test(before) && !/\d/.test(after)) return true;
      i = doc.indexOf(key, i + 1);
    }
    return false;
  });
}

export type HrrDraft = {
  values: Partial<Record<HrrField, string>>;
  /** Fields Nectar filled (shown as "Filled by Nectar — check this"). */
  filled: HrrField[];
  /** Fields Nectar answered but whose answer failed the check, so were dropped. */
  dropped: HrrField[];
};

/** Parses Nectar's reply and keeps only answers that check out against the document. */
export function checkHrrDraft(raw: string, docText: string): HrrDraft {
  const clean = String(raw ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let fields: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(clean || "{}") as { fields?: unknown };
    if (parsed.fields && typeof parsed.fields === "object" && !Array.isArray(parsed.fields))
      fields = parsed.fields as Record<string, unknown>;
  } catch {
    fields = {};
  }
  const out: HrrDraft = { values: {}, filled: [], dropped: [] };
  for (const field of HRR_FIELDS) {
    const v = fields[field];
    if (typeof v !== "string" || !v.trim()) continue;
    const text = v.replace(/\s+/g, " ").trim();
    let kept: string | null = null;
    if ((HRR_DATE_FIELDS as readonly string[]).includes(field)) {
      const ymd = parseHrrDate(text);
      kept = ymd && dateInDocument(ymd, docText) ? ymd : null;
    } else if (text.length <= MAX_ANSWER && traceableToDocument(text, docText)) {
      kept = text;
    }
    if (kept) {
      out.values[field] = kept;
      out.filled.push(field);
    } else out.dropped.push(field);
  }
  return out;
}

/** Nectar marks left after a person edits or confirms some fields. */
export function remainingNectarFields(
  marks: readonly string[] | null | undefined,
  cleared: Iterable<string>,
): HrrField[] {
  const gone = new Set(cleared);
  return (marks ?? []).filter((f): f is HrrField => isHrrField(f) && !gone.has(f));
}

// ── Saving ────────────────────────────────────────────────────────────────

/** Signature and HRC columns. Who/when is stamped by the database, never sent. */
export const HRR_SIGNATURE_COLUMNS = [
  "consent_signer_name",
  "consent_signer_role",
  "consent_client_name",
  "admin_signer_name",
  "sc_name",
  "sc_signed_on",
  "sc_method",
  "hrc_decision",
  "hrc_decision_on",
] as const;

const TEXT_COLUMNS = new Set<string>([
  "restriction_title",
  ...HRR_TEXT_FIELDS,
  "consent_signer_name",
  "consent_client_name",
  "admin_signer_name",
  "sc_name",
]);
const DATE_COLUMNS = new Set<string>([...HRR_DATE_FIELDS, "sc_signed_on", "hrc_decision_on"]);
const CHOICES: Record<string, readonly string[]> = {
  consent_signer_role: ["client", "guardian"],
  sc_method: SC_METHODS.map((m) => m.value),
  hrc_decision: ["approved", "denied"],
};

/**
 * The columns a save may change, cleaned: text trimmed (blank → null), dates
 * checked, choices checked. Anything else (ids, who/when stamps) is refused.
 */
export function cleanHrrPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "active") {
      if (typeof v !== "boolean") throw new Error("Active must be yes or no.");
      out[k] = v;
    } else if (k === "nectar_fields") {
      if (!Array.isArray(v)) throw new Error("Bad Nectar marks.");
      out[k] = remainingNectarFields(v.map(String), []);
    } else if (TEXT_COLUMNS.has(k)) {
      if (v != null && typeof v !== "string") throw new Error(`${k} must be text.`);
      const t = (v ?? "").replace(/\s+$/g, "").trim();
      if (t.length > 5000) throw new Error("That answer is too long.");
      out[k] = t || null;
    } else if (DATE_COLUMNS.has(k)) {
      if (v == null || v === "") out[k] = null;
      else {
        const ymd = typeof v === "string" ? parseHrrDate(v) : null;
        if (!ymd) throw new Error("Enter a real date.");
        out[k] = ymd;
      }
    } else if (k in CHOICES) {
      if (v == null || v === "") out[k] = null;
      else if (typeof v === "string" && CHOICES[k].includes(v)) out[k] = v;
      else throw new Error(`Unknown value for ${k}.`);
    } else {
      throw new Error(`${k} can't be changed here.`);
    }
  }
  if (out.restriction_title === null) throw new Error("Give the restriction a title.");
  return out;
}

/** True when the save adds or changes a signature (needs Clients: Edit as well as HRC: Edit). */
export function hrrPatchSigns(patch: Record<string, unknown>): boolean {
  return HRR_SIGNATURE_COLUMNS.some((c) => c in patch && patch[c] != null);
}

/** What the signers agreed to: the title and every answer. */
export const HRR_CONTENT_COLUMNS: readonly string[] = ["restriction_title", ...HRR_FIELDS];

/** The columns that make up each signature. */
export const HRR_SIGNER_COLUMNS: Record<HrrSignerKey, readonly string[]> = {
  consent: ["consent_signer_name", "consent_signer_role", "consent_client_name"],
  admin: ["admin_signer_name"],
  sc: ["sc_name", "sc_signed_on", "sc_method"],
  hrc: ["hrc_decision", "hrc_decision_on"],
};

/**
 * Signatures an edit to the answers takes away: when the save changes the
 * title or any answer, every signature already on the record (and not given
 * again in this same save) is cleared, so everyone signs what it now says.
 * The database trigger (hrr_stamp_signatures) does the clearing on every
 * update; this is the same rule, for the form's warning and the save's reply.
 */
export function signaturesClearedBy(
  before: RestrictionRecord,
  patch: Record<string, unknown>,
): HrrSignerKey[] {
  const was = before as unknown as Record<string, unknown>;
  const changesContent = HRR_CONTENT_COLUMNS.some(
    (c) => c in patch && (patch[c] ?? null) !== (was[c] ?? null),
  );
  if (!changesContent) return [];
  return (Object.keys(HRR_SIGNER_COLUMNS) as HrrSignerKey[]).filter((k) => {
    const cols = HRR_SIGNER_COLUMNS[k];
    return cols.some((c) => was[c] != null && was[c] !== "") && !cols.some((c) => c in patch);
  });
}

/** Why this save can't go through, or null. Signing needs every required question answered. */
export function hrrSaveError(before: RestrictionRecord, patch: Record<string, unknown>): string | null {
  if (!hrrPatchSigns(patch)) return null;
  const after = { ...before, ...patch } as RestrictionRecord;
  if (missingQuestions(after).length) return "Answer every question before anyone signs.";
  if (filled(after.sc_name) && (!after.sc_signed_on || !scMethodLabel(after.sc_method)))
    return "Add the date the support coordinator signed and how it was obtained.";
  if (after.hrc_decision && !after.hrc_decision_on) return "Add the date of the committee's decision.";
  return null;
}
