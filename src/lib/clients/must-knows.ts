// Must-knows: the pure parts. Nectar drafts short bullets under a few
// headings from the client's documents (and the must-knows already written);
// this file builds the prompt, checks every bullet's source, turns approved
// bullets into the clients.special_directions text (headings + "- " lines),
// and reads that text back into blocks for the card. No Supabase here.

import { docKindLabel, docsPrompt, type AboutDoc } from "./about-me.ts";
import { formatDate } from "./dates.ts";

export const MUST_KNOW_SECTIONS = [
  { key: "health", heading: "Health" },
  { key: "behaviors", heading: "Behaviors" },
  { key: "trauma", heading: "Trauma" },
  { key: "support", heading: "How to support" },
  { key: "other", heading: "Other critical" },
] as const;

export type MustKnowSection = (typeof MUST_KNOW_SECTIONS)[number]["key"];

/** One bullet. source_doc_id null = it came from the must-knows already written. */
export type MustKnowItem = {
  section: MustKnowSection;
  text: string;
  source_doc_id: string | null;
  source_page: number | null;
};

export type MustKnowsDraft = { items: MustKnowItem[]; basedOn: string[]; skipped: string[] };

export type MustKnowsApproval = {
  approvedAt: string;
  approverName: string;
  approvedText: string;
  items: MustKnowItem[];
};

export const MUST_KNOWS_MAX_ITEMS = 25;
const MAX_TEXT = 220;
const SECTION_KEYS = new Set<unknown>(MUST_KNOW_SECTIONS.map((s) => s.key));

export const isMustKnowSection = (v: unknown): v is MustKnowSection => SECTION_KEYS.has(v);

export const MUST_KNOWS_SYSTEM = [
  "You are NECTAR, helping a Utah disability services agency tell team members the few things they MUST know before working with a person.",
  "Read ONLY the text provided: the person's documents and the must-knows already written.",
  'Write short bullets in plain, everyday words, each at most 25 words, saying what staff must know or do (for example: "Choking risk: cut food into small bites and stay with her while she eats.").',
  'Put each bullet in one section: "health" (health issues, allergies, seizures, diet, choking), "behaviors" (behaviors and what to do), "trauma" (trauma history and triggers to avoid), "support" (specific supports staff must give), "other" (any other critical safety point). Skip sections the text says nothing about.',
  "Only critical points. No routines, likes or general background. Never invent or guess; if the text says little, write few bullets.",
  'Every bullet must come from one document and page below, or from the existing must-knows (then use "source_doc_id": "existing" and "source_page": null).',
  'Respond ONLY with JSON: { "items": [ { "section": "health", "text": "...", "source_doc_id": "<doc id>", "source_page": <page number> } ] }.',
].join("\n");

/** Existing must-knows first, then every readable page with its document id. */
export function mustKnowsPrompt(
  firstName: string,
  existing: string | null,
  docs: readonly AboutDoc[],
): string {
  const header = [`PERSON: ${firstName.trim() || "the client"}`];
  if (existing?.trim()) header.push(`\n[EXISTING MUST-KNOWS]\n${existing.trim()}`);
  return docsPrompt(header.join("\n"), docs);
}

/**
 * Keep bullets with a known section, text, and a source that is one of the
 * client's documents (and a page that exists) or the existing must-knows when
 * there were some. No repeats, at most MUST_KNOWS_MAX_ITEMS, grouped in
 * section order. Runs on the draft and again on approve.
 */
export function checkMustKnowItems(
  raw: readonly unknown[],
  docs: readonly Pick<AboutDoc, "id" | "pages">[],
  hasExisting: boolean,
): MustKnowItem[] {
  const pagesById = new Map(docs.map((d) => [d.id, d.pages.length]));
  const seen = new Set<string>();
  const out: MustKnowItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const section = typeof o.section === "string" ? o.section.trim().toLowerCase() : "";
    const text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim() : "";
    const rawId = typeof o.source_doc_id === "string" ? o.source_doc_id : null;
    const fromExisting = rawId === null || rawId === "existing";
    if (!text || !isMustKnowSection(section)) continue;
    if (fromExisting ? !hasExisting : !pagesById.has(rawId)) continue;
    const pageCount = fromExisting ? 0 : (pagesById.get(rawId) ?? 0);
    const page = Number(o.source_page);
    const hasPage = !fromExisting && Number.isInteger(page);
    if (hasPage && (page < 1 || (pageCount > 0 && page > pageCount))) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      section,
      text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text,
      source_doc_id: fromExisting ? null : rawId,
      source_page: hasPage ? page : null,
    });
    if (out.length >= MUST_KNOWS_MAX_ITEMS) break;
  }
  const order = (s: MustKnowSection) => MUST_KNOW_SECTIONS.findIndex((x) => x.key === s);
  return out.sort((a, b) => order(a.section) - order(b.section));
}

/** "PCSP p. 3", or "Existing must-knows". */
export function mustKnowSource(
  item: Pick<MustKnowItem, "source_doc_id" | "source_page">,
  docs: readonly { id: string; type: string | null }[],
): string {
  if (!item.source_doc_id) return "Existing must-knows";
  const doc = docs.find((d) => d.id === item.source_doc_id);
  const kind = doc ? docKindLabel(doc.type) : "document";
  const label = kind.charAt(0).toUpperCase() + kind.slice(1);
  return item.source_page ? `${label} p. ${item.source_page}` : label;
}

/** Approved bullets → special_directions: "Health:\n- …\n\nBehaviors:\n- …". */
export function formatMustKnows(items: readonly Pick<MustKnowItem, "section" | "text">[]): string {
  return MUST_KNOW_SECTIONS.map(({ key, heading }) => {
    const lines = items.filter((i) => i.section === key && i.text.trim());
    if (!lines.length) return "";
    return [`${heading}:`, ...lines.map((i) => `- ${i.text.replace(/\s+/g, " ").trim()}`)].join(
      "\n",
    );
  })
    .filter(Boolean)
    .join("\n\n");
}

export type MustKnowBullet = { text: string; details: { label: string; value: string }[] };
export type MustKnowBlock = { heading: string | null; bullets: MustKnowBullet[]; text: string[] };

const BULLET = /^\s*[-•*]\s+/;
const HEADING = /^[^-•*\s].{0,78}:$/;
const PCSP_HEAD = /^From PCSP (\d{4}-\d{2}-\d{2}) – (\d{4}-\d{2}-\d{2})$/;
const DETAILS = /\s(Response time|Response):\s/;

/** "From PCSP 2026-10-01 – 2027-09-30" → "From PCSP Oct 1, 2026 – Sep 30, 2027". */
function headingLabel(line: string): string {
  const h = line.replace(/:$/, "").trim();
  const m = PCSP_HEAD.exec(h);
  return m ? `From PCSP ${formatDate(m[1])} – ${formatDate(m[2])}` : h;
}

/** "Risk. Response: Do this. Response time: Immediate." → text + labeled parts. */
export function splitBullet(line: string): MustKnowBullet {
  const parts = line.split(DETAILS);
  const details: MustKnowBullet["details"] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const value = parts[i + 1].trim();
    if (value) details.push({ label: parts[i], value });
  }
  return { text: parts[0].trim(), details };
}

/** special_directions → blocks: a heading (or none), its bullets and any plain lines. */
export function parseMustKnows(text: string | null | undefined): MustKnowBlock[] {
  const blocks: MustKnowBlock[] = [];
  const open = (heading: string | null): MustKnowBlock => {
    const b: MustKnowBlock = { heading, bullets: [], text: [] };
    blocks.push(b);
    return b;
  };
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const last: MustKnowBlock | undefined = blocks[blocks.length - 1];
    if (BULLET.test(line)) {
      (last ?? open(null)).bullets.push(splitBullet(line.replace(BULLET, "")));
    } else if (HEADING.test(line)) {
      open(headingLabel(line));
    } else {
      (last && !last.bullets.length ? last : open(null)).text.push(line);
    }
  }
  return blocks;
}

/** "Approved Oct 8, 2026 by Pat Lee", plus ", edited since" when the text changed after. */
export function approvalLine(
  approval: Pick<MustKnowsApproval, "approvedAt" | "approverName" | "approvedText"> | null,
  current: string | null,
  formatWhen: (iso: string) => string,
): string | null {
  if (!approval) return null;
  const line = `Approved ${formatWhen(approval.approvedAt)} by ${approval.approverName}`;
  return (current ?? "").trim() === approval.approvedText.trim() ? line : `${line}, edited since`;
}
