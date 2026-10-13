// In-shift assist: the "am I allowed to…?" procedural Q&A (clock-out "ask a
// question" in punch-pad). Pure prompt and runner; lib/ai-coach.functions.ts
// adds the Nectar guard and binds the model to the caller's agency.

import { parseModelJson, type CoachModel } from "./coach-model.ts";

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
