// In-shift assists: the EVV geofence variance drafter and the "am I allowed
// to…?" procedural Q&A (clock-out "ask a question" in punch-pad). Pure prompts
// and runners; lib/ai-coach.functions.ts adds the Nectar guard and binds the
// model to the caller's agency.

import { parseModelJson, type CoachModel } from "./coach-model.ts";

// ─── Variance Justification Drafter — geofence rescue ────────────────────────

export interface VarianceDraftInput {
  shorthand: string;
  distanceFeet?: number | null;
  limitFeet?: number | null;
  serviceCode?: string | null;
  clientFirstName: string;
  phase: "clock_in" | "clock_out";
  frameBlocked?: boolean;
}

export function validateVariance(input: unknown): VarianceDraftInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const shorthand = typeof i.shorthand === "string" ? i.shorthand.trim() : "";
  if (shorthand.length < 2 || shorthand.length > 800) {
    throw new Error("Variance shorthand must be 2–800 characters.");
  }
  const phase = i.phase === "clock_out" ? "clock_out" : "clock_in";
  return {
    shorthand,
    distanceFeet: typeof i.distanceFeet === "number" ? i.distanceFeet : null,
    limitFeet:    typeof i.limitFeet === "number" ? i.limitFeet : null,
    serviceCode:  typeof i.serviceCode === "string" ? i.serviceCode.slice(0, 16) : null,
    clientFirstName:
      typeof i.clientFirstName === "string" ? i.clientFirstName.slice(0, 80) : "the client",
    phase,
    frameBlocked: !!i.frameBlocked,
  };
}

export interface VarianceDraftResult { draft: string; }

const VARIANCE_SYSTEM = `You are NECTAR, drafting an EVV geofence variance justification for a Medicaid DSPD caregiver.

GOAL: Turn the caregiver's quick shorthand into a 2–4 sentence written justification (40–90 words) that an auditor will accept. Past tense, objective, no fluff, no fabrication.

RULES:
- Never invent a reason that wasn't implied by the shorthand. If the shorthand is sparse, write a baseline-honest justification (e.g. "Device location was restricted at clock-in; caregiver confirmed proximity to the client visually.").
- If the caregiver indicates community access / outing / transit / appointment, frame it as community-based service delivery aligned with the client's plan.
- If the caregiver indicates a device/GPS/signal issue, frame it as a technology variance, not a service variance.
- Mention the measured distance and the allowed radius if both are provided.
- No markdown. Return one short paragraph.

OUTPUT FORMAT — STRICT JSON only:
{"draft":"<the justification paragraph>"}`;

export async function runDraftVariance(
  data: VarianceDraftInput,
  model: CoachModel,
): Promise<VarianceDraftResult> {
  const user = `PHASE: ${data.phase === "clock_in" ? "Clock-in" : "Clock-out"}
CLIENT FIRST NAME: ${data.clientFirstName}
SERVICE CODE: ${data.serviceCode ?? "—"}
MEASURED DISTANCE (ft): ${data.distanceFeet ?? "unknown"}
ALLOWED RADIUS (ft): ${data.limitFeet ?? "unknown"}
DEVICE LOCATION BLOCKED: ${data.frameBlocked ? "yes" : "no"}

CAREGIVER SHORTHAND:
"""
${data.shorthand}
"""`;

  const parsed = parseModelJson(await model(VARIANCE_SYSTEM, user));
  const draft = typeof parsed.draft === "string" ? parsed.draft.trim() : "";
  if (!draft) throw new Error("NECTAR could not draft a justification — please write one manually.");
  return { draft };
}

// ─── Procedural Q&A — "am I allowed to…?" grounded in client context ─────────

export interface ProceduralInput {
  question: string;
  clientFirstName: string;
  serviceCode?: string | null;
  pcspGoals?: string[];
  notes?: string | null;
}

export function validateProcedural(input: unknown): ProceduralInput {
  const i = (input ?? {}) as Record<string, unknown>;
  const question = typeof i.question === "string" ? i.question.trim() : "";
  if (question.length < 4 || question.length > 500) {
    throw new Error("Question must be 4–500 characters.");
  }
  return {
    question,
    clientFirstName: typeof i.clientFirstName === "string" ? i.clientFirstName.slice(0, 80) : "the client",
    serviceCode:     typeof i.serviceCode === "string" ? i.serviceCode.slice(0, 16) : null,
    pcspGoals:       Array.isArray(i.pcspGoals) ? (i.pcspGoals as unknown[]).map((g) => String(g)).slice(0, 25) : [],
    notes:           typeof i.notes === "string" ? i.notes.slice(0, 2000) : null,
  };
}

export interface ProceduralResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  escalate: boolean;
}

const PROCEDURAL_SYSTEM = `You are NECTAR, a procedural assistant for Medicaid DSPD direct-support staff. The caregiver is asking a plain-language "am I allowed to…?" question mid-shift. Answer directly. Do NOT deflect with "contact your supervisor" unless the question is genuinely outside policy guidance (active emergency, suspected abuse/neglect, clinical decision).

ANSWER STYLE:
- 2–4 short sentences. Plain English, second person ("you can…", "before you do…").
- Ground the answer in the client's context when provided (first name, service code, PCSP goals, notes). If the client context is silent on the topic, say so and give the general DSPD/PCSP best practice.
- If the action would require a written variance, an incident report, an eMAR entry, a PRN entry, or supervisor sign-off, name that follow-up explicitly.
- If the question describes an active emergency or suspected abuse/neglect/exploitation, set escalate=true and the answer must lead with "Call 911 / contact your on-call supervisor now" before any other guidance.
- Never invent client-specific facts that aren't in the provided context.

CONFIDENCE:
- "high" — general DSPD/EVV/Medicaid practice that is well-established.
- "medium" — depends on the company's policy or the client's PCSP, and you said so.
- "low" — you don't have enough context; tell the caregiver what to check.

OUTPUT FORMAT — STRICT JSON only, no markdown, no code fences:
{"answer":"<2–4 sentences>","confidence":"high"|"medium"|"low","escalate":true|false}`;

export async function runAnswerProcedural(
  data: ProceduralInput,
  model: CoachModel,
): Promise<ProceduralResult> {
  const user = `CLIENT FIRST NAME: ${data.clientFirstName}
SERVICE CODE: ${data.serviceCode ?? "—"}
PCSP GOALS (${data.pcspGoals?.length ?? 0}):
${data.pcspGoals && data.pcspGoals.length ? data.pcspGoals.map((g, i) => `${i + 1}. ${g}`).join("\n") : "(none on file)"}

CLIENT NOTES / RELEVANT POLICY CONTEXT:
${data.notes ?? "(none provided)"}

CAREGIVER QUESTION:
"""
${data.question}
"""`;

  const parsed = parseModelJson(await model(PROCEDURAL_SYSTEM, user));
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) throw new Error("NECTAR could not produce an answer — try rephrasing your question.");
  const confidence: ProceduralResult["confidence"] =
    parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : "medium";
  return { answer, confidence, escalate: !!parsed.escalate };
}
