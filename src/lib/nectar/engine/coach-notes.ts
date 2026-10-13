// Shift-note coach: the submit-time completeness check, draft assist and the
// incident / medical / eMAR trigger scan. Pure prompts and runners; the server
// functions in lib/ai-coach.functions.ts add the Nectar guard and bind the
// model to the caller's agency.

import {
  COMPLETENESS_LABELS,
  localWordCountCheck,
  mergeLocalAndNectarChecks,
  parseNectarCompletenessPayload,
  type CompletenessItem,
  type CompletenessResult,
} from "../../nectar-completeness.ts";
import { parseModelJson, type CoachModel } from "./coach-model.ts";

/** Submit-time completeness result. Kept as CoachResult so existing callers compile. */
export type CoachResult = CompletenessResult;

export interface ScanResult {
  hasIncidentTrigger: boolean;
  hasMedicalTrigger: boolean;
  hasEmarTrigger: boolean;
  triggerTypes: string[];
  triggerSummary: string;
}

export interface ShiftNoteFollowUp {
  question: string;
}

export interface DraftResult {
  draft: string;
  wordCount: number;
  followUps: ShiftNoteFollowUp[];
}

// ─── Input validators ────────────────────────────────────────────────────────

export interface CoachInput {
  narrative: string;
  goals: string[];
  clientFirstName: string;
  serviceCode: string;
}

export function validateCoach(input: unknown): CoachInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const narrative = typeof i.narrative === "string" ? i.narrative : "";
  const goals = Array.isArray(i.goals)
    ? (i.goals as unknown[]).map((g) => String(g)).slice(0, 25)
    : [];
  const clientFirstName =
    typeof i.clientFirstName === "string"
      ? i.clientFirstName.slice(0, 80)
      : "the client";
  const serviceCode =
    typeof i.serviceCode === "string" ? i.serviceCode.slice(0, 16) : "";
  if (narrative.length === 0 || narrative.length > 8000) {
    throw new Error("Narrative must be 1–8000 characters.");
  }
  return { narrative, goals, clientFirstName, serviceCode };
}

export interface ScanInput {
  narrative: string;
  clientFirstName: string;
}

export function validateScan(input: unknown): ScanInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const narrative = typeof i.narrative === "string" ? i.narrative : "";
  const clientFirstName =
    typeof i.clientFirstName === "string"
      ? i.clientFirstName.slice(0, 80)
      : "the client";
  if (narrative.length === 0 || narrative.length > 8000) {
    throw new Error("Narrative must be 1–8000 characters.");
  }
  return { narrative, clientFirstName };
}

export interface DraftInput {
  shorthand: string;
  goals: string[];
  clientFirstName: string;
  followUpAnswers?: string;
}

export function validateDraft(input: unknown): DraftInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const shorthand = typeof i.shorthand === "string" ? i.shorthand.trim() : "";
  const goals = Array.isArray(i.goals)
    ? (i.goals as unknown[]).map((g) => String(g)).slice(0, 25)
    : [];
  const clientFirstName =
    typeof i.clientFirstName === "string"
      ? i.clientFirstName.slice(0, 80)
      : "the client";
  if (shorthand.length < 3 || shorthand.length > 4000) {
    throw new Error("Shorthand must be 3–4000 characters.");
  }
  const followUpAnswers =
    typeof i.followUpAnswers === "string" ? i.followUpAnswers.trim().slice(0, 4000) : "";
  return { shorthand, goals, clientFirstName, followUpAnswers: followUpAnswers || undefined };
}

// ─── Documentation Quality Coach ─────────────────────────────────────────────

const COMPLETENESS_SYSTEM = `You are NECTAR running the submit completeness check on a Utah DSPD progress note.

Evaluate ONLY these three items. Do NOT flag goal alignment, noteworthy observations, style, or length — word count is checked separately.

1. CLIENT REFERENCED — The note names or clearly refers to this specific client (first name, or an unambiguous pronoun referring to the named person). A note that could be about someone else fails.

2. SUPPORT PROVIDED — The note describes what staff did to support the client (prompted, assisted, facilitated, redirected, provided). Client-only activity with no staff action fails.

3. CLIENT RESPONSE — The note describes how the client responded: a behavior, choice, verbal reply, or reaction. Mood-only ("good mood") without a response fails.

For each item return passed true/false and a one-sentence message. If failed, say exactly what sentence to add. If passed, briefly confirm what you saw.

OUTPUT — STRICT JSON only, no markdown, no code fences:
{"client_referenced":{"passed":true|false,"message":"..."},"support_provided":{"passed":true|false,"message":"..."},"client_response":{"passed":true|false,"message":"..."}}`;

export const NECTAR_OFF_COMPLETENESS_FEEDBACK = `Only the ${COMPLETENESS_LABELS.word_count} was checked. Nectar is turned off for your agency.`;

function nectarOffCompleteness(wordCheck: CompletenessItem): CoachResult {
  const notChecked = (key: Exclude<CompletenessItem["key"], "word_count">): CompletenessItem => ({
    key,
    passed: true,
    message: `${COMPLETENESS_LABELS[key]}: not checked (Nectar is off).`,
  });
  return {
    status: "Verified",
    feedback: NECTAR_OFF_COMPLETENESS_FEEDBACK,
    checks: [
      wordCheck,
      notChecked("client_referenced"),
      notChecked("support_provided"),
      notChecked("client_response"),
    ],
  };
}

/**
 * Local 30-word check, then Nectar's three items. `model` is null when Nectar
 * is off for the agency: only the word count gates the note and the feedback
 * says so, so clock-out never depends on a feature the agency doesn't have.
 */
export async function runEvaluateShiftNote(
  data: CoachInput,
  model: CoachModel | null,
): Promise<CoachResult> {
  const wordCheck = localWordCountCheck(data.narrative);
  if (!wordCheck.passed) {
    return {
      status: "Flagged",
      feedback: wordCheck.message,
      checks: [wordCheck],
    };
  }
  if (!model) return nectarOffCompleteness(wordCheck);

  const user = `SERVICE CODE: ${data.serviceCode}
CLIENT FIRST NAME: ${data.clientFirstName}
CHECKED PCSP GOALS (${data.goals.length}):
${data.goals.length ? data.goals.map((g, i) => `${i + 1}. ${g}`).join("\n") : "(none)"}

CAREGIVER NARRATIVE:
"""
${data.narrative}
"""`;

  const parsed = parseModelJson(await model(COMPLETENESS_SYSTEM, user));
  return mergeLocalAndNectarChecks(data.narrative, parseNectarCompletenessPayload(parsed));
}

// ─── Draft Assist — expand shorthand/voice into a compliant draft note ───────

function draftSystem(foldingAnswers: boolean): string {
  return `You are NECTAR, a Medicaid DSPD progress-note drafting assistant for direct-support caregivers.

GOAL:
Expand the caregiver's own note into a professional, audit-ready progress-note narrative. The caregiver already wrote what happened — do not invent facts.

REQUIREMENTS:
- Write 40–100 words. Past tense, third person, objective and behavior-focused.
- Explicitly describe how STAFF supported the person (prompted, assisted, facilitated, redirected).
- Reference each checked PCSP goal only from what the caregiver wrote. If a goal is not covered, do not fabricate an event.
- Use the client's first name naturally.
- Never invent injuries, medications, or incidents.
- No markdown, no headings, no bullet lists — one or two clean paragraphs.

FOLLOW-UPS:
- If the caregiver note does not clearly say HOW staff supported the person, add 1–3 concrete follow-up questions in "followUps".
- Each question must be answerable in one sentence (e.g. "What did you say or do when Blake refused the first activity?").
- If follow-up answers are provided below, fold those answers into the draft and return an empty followUps array.
${foldingAnswers ? "- Follow-up answers ARE provided. Fold them in. Return followUps: []." : ""}

OUTPUT FORMAT — return STRICT JSON only, no markdown, no code fences:
{"draft":"<the narrative paragraph(s)>","followUps":[{"question":"<one concrete question>"}]}`;
}

export async function runDraftShiftNote(data: DraftInput, model: CoachModel): Promise<DraftResult> {
  const foldingAnswers = !!data.followUpAnswers;
  const user = `CLIENT FIRST NAME: ${data.clientFirstName}
CHECKED PCSP GOALS (${data.goals.length}):
${data.goals.length ? data.goals.map((g, i) => `${i + 1}. ${g}`).join("\n") : "(none — write a general baseline-support narrative)"}

CAREGIVER NOTE:
"""
${data.shorthand}
"""
${data.followUpAnswers ? `\nSTAFF ANSWERS TO NECTAR FOLLOW-UPS:\n"""\n${data.followUpAnswers}\n"""` : ""}`;

  const parsed = parseModelJson(await model(draftSystem(foldingAnswers), user));
  const draft = typeof parsed.draft === "string" ? parsed.draft.trim() : "";
  if (!draft) throw new Error("NECTAR could not generate a draft — please try again or write the note manually.");

  const followUps: ShiftNoteFollowUp[] = foldingAnswers
    ? []
    : Array.isArray(parsed.followUps)
      ? (parsed.followUps as unknown[])
          .map((g) => g as Record<string, unknown>)
          .filter((g) => typeof g?.question === "string" && String(g.question).trim().length > 0)
          .slice(0, 3)
          .map((g) => ({ question: String(g.question).trim().slice(0, 240) }))
      : [];

  const wordCount = draft.split(/\s+/).filter(Boolean).length;
  return { draft, wordCount, followUps };
}

// ─── Content Scanner — runs AFTER quality coach passes ───────────────────────
// Detects incident/medical/eMAR triggers that require follow-up forms.

const SCAN_SYSTEM = `You are a compliance trigger scanner for a Medicaid DSPD caregiving platform. 
Analyze the caregiver's narrative and determine if any of the following reportable events are described.

TRIGGER CATEGORIES:
1. INCIDENT — physical altercation, aggression, self-harm, fall, injury, elopement/missing person, property damage, law enforcement involvement, restraint, abuse/neglect/exploitation, death
2. MEDICAL — hospital visit, ER, urgent care, 911 called, ambulance, seizure, medical emergency, hospitalization, significant health change
3. EMAR — medication refusal, missed dose, wrong medication, wrong dose, adverse reaction, medication side effect, PRN administered for behavioral reason

OUTPUT FORMAT — return STRICT JSON only, no markdown, no code fences:
{
  "hasIncidentTrigger": true|false,
  "hasMedicalTrigger": true|false,
  "hasEmarTrigger": true|false,
  "triggerTypes": ["array of specific trigger labels found, e.g. 'fall', 'medication refusal'"],
  "triggerSummary": "One sentence describing what was detected, or empty string if nothing found"
}

Only flag genuine trigger events described in past tense as having occurred. Do not flag general mentions, hypotheticals, or training references.`;

export async function runScanNoteForTriggers(data: ScanInput, model: CoachModel): Promise<ScanResult> {
  const user = `CLIENT FIRST NAME: ${data.clientFirstName}

CAREGIVER NARRATIVE:
"""
${data.narrative}
"""`;

  const parsed = parseModelJson(await model(SCAN_SYSTEM, user)) as Partial<ScanResult>;
  return {
    hasIncidentTrigger: !!parsed.hasIncidentTrigger,
    hasMedicalTrigger:  !!parsed.hasMedicalTrigger,
    hasEmarTrigger:     !!parsed.hasEmarTrigger,
    triggerTypes:       Array.isArray(parsed.triggerTypes) ? parsed.triggerTypes : [],
    triggerSummary:     typeof parsed.triggerSummary === "string" ? parsed.triggerSummary : "",
  };
}
