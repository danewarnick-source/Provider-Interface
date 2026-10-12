// "Pull strategies from this document": Nectar COPIES the strategies already
// written in an uploaded strategies document under each PCSP support paid to
// the agency. It never writes new content: every bullet it returns is checked
// against the document text (near-verbatim: same words, ignoring case,
// punctuation, spacing and line breaks) and dropped when not found. A support
// with nothing found is left blank and named. The result is a marked Nectar
// draft an admin approves; the uploaded file stays the official copy.
// Pure (no Supabase), node --test.

import type { StrategySupport } from "./support-strategies.ts";

/** Most document text sent to Nectar. */
export const PULL_MAX_CHARS = 60_000;
/** Shorter bullets are too generic to prove they came from the document. */
export const PULL_MIN_WORDS = 3;

export const PULL_SYSTEM_PROMPT = [
  "You are NECTAR, helping a Utah DSPD provider agency move its existing support strategies document into its records.",
  "You are given the person's PCSP supports (numbered) and the text of the agency's uploaded support strategies document.",
  "For EACH support, COPY the strategy sentences or bullet points from the document that are written for that support or its goal.",
  "Copy word for word. Never reword, summarize, combine, complete or invent anything. Never add content that is not in the document.",
  "If the document has nothing for a support, return an empty list for it.",
  'Respond ONLY with JSON: { "strategies": [ { "n": 1, "bullets": ["exact text from the document", "..."] } ] } with one entry per support, "n" matching the support number. No preamble, no markdown fences.',
].join("\n");

/** The numbered supports and the document text, as the user message. */
export function pullUserPrompt(supports: readonly StrategySupport[], docText: string): string {
  const lines = supports.map((s, i) =>
    [
      `${i + 1}. Goal: ${s.goal || "Not linked to a goal"}`,
      `   Support: ${s.support || "Not written"}`,
      `   Service codes: ${s.codes.join(", ") || "None"}`,
    ].join("\n"),
  );
  return `PCSP SUPPORTS (${supports.length}):\n${lines.join("\n")}\n\nSTRATEGIES DOCUMENT TEXT:\n${docText.slice(0, PULL_MAX_CHARS)}`;
}

/** Lower case letters and digits only: spacing, punctuation and line-break hyphens don't matter. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/-\s*\n\s*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** A bullet without its leading "-", "•" or "1." marker. */
export function cleanBullet(raw: string): string {
  return raw
    .replace(/^\s*(?:[-–—•*▪●◦]|\d{1,2}[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The bullet appears in the document (near-verbatim) and is long enough to tell. */
export function bulletInDocument(bullet: string, normalizedDoc: string): boolean {
  const words = bullet.split(/\s+/).filter(Boolean);
  if (words.length < PULL_MIN_WORDS) return false;
  const key = normalizeForMatch(bullet);
  return key.length > 0 && normalizedDoc.includes(key);
}

export type PullResult = {
  /** supportId → bullets found in the document. */
  drafts: Map<string, string[]>;
  /** Supports left blank (nothing found in the document). */
  blank: StrategySupport[];
  /** Bullets Nectar returned that were not in the document. */
  dropped: number;
};

/** Parses Nectar's reply and keeps only bullets found in the document text. */
export function parsePullReply(
  raw: string,
  supports: readonly StrategySupport[],
  docText: string,
): PullResult {
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
  const doc = normalizeForMatch(docText);
  const drafts = new Map<string, string[]>();
  const blank: StrategySupport[] = [];
  let dropped = 0;
  supports.forEach((s, i) => {
    const row = rows.find((r) => Number(r?.n) === i + 1);
    const given = Array.isArray(row?.bullets) ? (row!.bullets as unknown[]) : [];
    const kept: string[] = [];
    for (const b of given) {
      const text = typeof b === "string" ? cleanBullet(b) : "";
      if (text && bulletInDocument(text, doc)) {
        if (!kept.includes(text)) kept.push(text);
      } else if (text) dropped += 1;
    }
    if (kept.length) drafts.set(s.supportId, kept);
    else blank.push(s);
  });
  return { drafts, blank, dropped };
}
