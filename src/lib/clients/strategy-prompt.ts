// What Nectar is asked when it drafts support strategies, and how its reply
// is checked. For each PCSP support paid to the agency Nectar writes 4–6
// bullet points: concrete, observable things staff do to support the person
// with that goal and support. The contract's rules (DHHS91172 SOW) are in the
// prompt. The reply is validated here; a support whose bullets fail the
// check gets no draft. Pure (no Supabase), node --test.

import {
  EMPLOYMENT_CODES,
  JOB_DEVELOPMENT_CODES,
  MAX_BULLETS,
  MAX_BULLET_WORDS,
  MIN_BULLETS,
  bulletProblem,
} from "./strategy-rules.ts";
import type { StrategySupport } from "./support-strategies.ts";

export const STRATEGY_SYSTEM_PROMPT = [
  "You are NECTAR, drafting support strategies for a Utah DSPD provider agency (contract DHHS91172, SOW §1.24(5)).",
  "A support strategy tells direct-support staff what they will do to support the person with one specific PCSP goal and support.",
  `For EACH support given, write ${MIN_BULLETS} to ${MAX_BULLETS} bullet points. Each bullet is one concrete, observable action staff take on shift.`,
  `Rules for every bullet: plain English; present tense ("Staff offer…", "Staff model…"); person-centered (the person's choices and preferences come first); at most ${MAX_BULLET_WORDS} words; no bullet characters or numbering inside the text.`,
  "Use ONLY the goal, support, support details and service codes given. Never invent facts, history, preferences, diagnoses, medications, clinical or behavioral protocols, or medical procedures. Never speculate about a diagnosis.",
  "If the details are thin, write general good-practice actions that follow directly from the support as written.",
  "Strategies are what staff implement and what each shift note ties back to, so make every bullet something a note could record (SOW §1.24(6), §18.3(2)(E)).",
  "Supported employment (SEI, SED, SEC, SEE): every strategy aims to increase the person's independence on the job and to fade paid employment support over time (SOW §28.2(6), §30.2(7)).",
  "Supported job development (SJD): job strategies are based on the person's needs, strengths, abilities and interests (SOW §33.2(g)).",
  "This is a DRAFT. An agency admin reviews, edits and approves it before staff see it.",
  'Respond ONLY with JSON: { "strategies": [ { "n": 1, "bullets": ["...", "..."] } ] } with one entry per support, "n" matching the support number. No preamble, no markdown fences.',
].join("\n");

/** Extra rule lines for a support's codes (employment, job development). */
export function codeGuidance(codes: readonly string[]): string[] {
  const cs = codes.map((c) => c.toUpperCase());
  const out: string[] = [];
  if (cs.some((c) => EMPLOYMENT_CODES.has(c))) {
    out.push("Employment: build on-the-job independence and fade paid support.");
  }
  if (cs.some((c) => JOB_DEVELOPMENT_CODES.has(c))) {
    out.push(
      "Job development: base job strategies on the person's needs, strengths, abilities and interests.",
    );
  }
  return out;
}

/** The numbered supports, as the user message. */
export function strategyUserPrompt(supports: readonly StrategySupport[]): string {
  const lines = supports.map((s, i) => {
    const rules = codeGuidance(s.codes);
    return [
      `${i + 1}. Goal: ${s.goal || "Not linked to a goal"}`,
      `   Support: ${s.support || "Not written"}`,
      `   Support details: ${s.details || "None listed"}`,
      `   Service codes: ${s.codes.join(", ") || "None"}`,
      ...rules.map((r) => `   Rule: ${r}`),
    ].join("\n");
  });
  return `PCSP SUPPORTS (${supports.length}):\n${lines.join("\n")}`;
}

export type StrategyReply = {
  /** supportId → valid bullets. */
  drafts: Map<string, string[]>;
  /** Supports whose bullets were missing or failed the check, with why. */
  failed: { support: StrategySupport; problem: string }[];
};

/** Parses Nectar's JSON reply and keeps only bullets that pass the check. */
export function parseStrategyReply(
  raw: string,
  supports: readonly StrategySupport[],
): StrategyReply {
  const clean = String(raw ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let rows: Array<{ n?: unknown; bullets?: unknown }> = [];
  try {
    const parsed = JSON.parse(clean || "{}") as { strategies?: unknown };
    if (Array.isArray(parsed.strategies)) rows = parsed.strategies as typeof rows;
  } catch {
    rows = [];
  }
  const drafts = new Map<string, string[]>();
  const failed: StrategyReply["failed"] = [];
  supports.forEach((s, i) => {
    const row = rows.find((r) => Number(r?.n) === i + 1) ?? rows[i];
    const bullets = Array.isArray(row?.bullets) ? (row!.bullets as unknown[]) : [];
    const problem = bullets.length ? bulletProblem(bullets) : "no bullet points";
    if (problem) failed.push({ support: s, problem });
    else
      drafts.set(
        s.supportId,
        (bullets as string[]).map((b) => b.trim()),
      );
  });
  return { drafts, failed };
}
