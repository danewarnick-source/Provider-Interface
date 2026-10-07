// "About <first name>": the pure parts of the Nectar summary of who a client
// is. Nectar drafts bullets from the client's own documents; this file builds
// the prompt, checks every bullet's source is one of the client's documents
// (dropping the rest), and words the card. A person approves before saving.
// No Supabase here — importable by node --test.

import { PCSP_DOC_TYPES, normType } from "./file-docs.ts";

export type AboutItem = { text: string; source_doc_id: string; source_page: number | null };

/** A client document as Nectar sees it: its id, kind and page texts. */
export type AboutDoc = {
  id: string;
  type: string | null;
  name: string | null;
  uploadedAt: string | null;
  /** Page texts in order; empty when the file has no readable text (a scan). */
  pages: string[];
};

export type AboutDocInfo = Omit<AboutDoc, "pages">;

export type AboutSummary = {
  items: AboutItem[];
  draftedByNectar: boolean;
  approvedAt: string;
  approverName: string;
  basedOn: string[];
};

export type AboutView = { summary: AboutSummary | null; docs: AboutDocInfo[]; newDocs: boolean };

export type AboutDraft = { items: AboutItem[]; basedOn: string[]; skipped: string[] };

export const ABOUT_MAX_ITEMS = 10;
const MAX_TEXT = 240;
/** Characters of document text sent to Nectar (keeps the request a sane size). */
export const ABOUT_MAX_PROMPT_CHARS = 60_000;

const BSP_TYPES = new Set(["bsp", "behavior_support_plan"]);
const FACE_SHEET_TYPES = new Set(["face_sheet"]);

/** Plain name of a document kind: "PCSP", "BSP", "face sheet", else the type in words. */
export function docKindLabel(type: string | null | undefined): string {
  const t = normType(type);
  if (PCSP_DOC_TYPES.has(t)) return "PCSP";
  if (BSP_TYPES.has(t)) return "BSP";
  if (FACE_SHEET_TYPES.has(t)) return "face sheet";
  return t ? t.replace(/[_-]+/g, " ") : "document";
}

/** Documents whose arrival should prompt a refresh of the summary. */
export function isKeyAboutDoc(type: string | null | undefined): boolean {
  const t = normType(type);
  return PCSP_DOC_TYPES.has(t) || BSP_TYPES.has(t) || FACE_SHEET_TYPES.has(t);
}

/** Medical and incident content stays out of About, even if Nectar includes it. */
const LEAVE_OUT =
  /\b(medications?|meds|mg|dosage|prescri\w*|diagnos\w*|disorder|syndrome|medical history|incident\w*|hospitali[sz]\w*)\b/i;

export const ABOUT_SYSTEM = [
  "You are NECTAR, helping a Utah disability services agency introduce a person to the team members who support them.",
  'Read ONLY the documents provided. Write about 8-10 short bullets in plain, everyday words (for example: "Loves running and spending time with friends and his bunny.").',
  "Cover, only where the documents say so: who they are and what matters to them; likes and dislikes; a typical day and routines; people important to them; how they communicate; what helps them have a good day and what upsets them.",
  "Leave out medications, diagnoses, medical history and incident details.",
  "Never invent or guess. Every bullet must come from one document and page given below. If the documents say little, write fewer bullets. Never pad.",
  'Respond ONLY with JSON: { "items": [ { "text": "...", "source_doc_id": "<doc id>", "source_page": <page number> } ] }.',
].join("\n");

/** The documents as Nectar reads them, page by page, trimmed to ABOUT_MAX_PROMPT_CHARS. */
export function aboutPrompt(firstName: string, docs: readonly AboutDoc[]): string {
  const parts: string[] = [`PERSON: ${firstName.trim() || "the client"}`];
  let used = parts[0].length;
  for (const d of docs) {
    for (let i = 0; i < d.pages.length; i++) {
      const text = d.pages[i].trim();
      if (!text) continue;
      const block = `\n[DOCUMENT ${d.id} · ${docKindLabel(d.type)} · page ${i + 1}]\n${text}`;
      if (used + block.length > ABOUT_MAX_PROMPT_CHARS) return parts.join("\n");
      parts.push(block);
      used += block.length;
    }
  }
  return parts.join("\n");
}

/** Documents with no readable text (scans): skipped, and listed on the card. */
export function unreadableDocs(docs: readonly AboutDoc[]): AboutDoc[] {
  return docs.filter((d) => !d.pages.some((p) => p.trim()));
}

/** Nectar's reply → items (no checks yet). Bad JSON → []. */
export function parseAboutReply(content: string): unknown[] {
  try {
    const body = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
      items?: unknown;
    };
    return Array.isArray(body?.items) ? body.items : [];
  } catch {
    return [];
  }
}

/**
 * Keep only bullets whose source is one of the client's readable documents
 * (and a page that exists), with text, not medical, no repeats, at most
 * ABOUT_MAX_ITEMS. Runs on the draft and again on approve.
 */
export function checkAboutItems(
  raw: readonly unknown[],
  docs: readonly Pick<AboutDoc, "id" | "pages">[],
): AboutItem[] {
  const pagesById = new Map(docs.map((d) => [d.id, d.pages.length]));
  const seen = new Set<string>();
  const out: AboutItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim() : "";
    const docId = typeof o.source_doc_id === "string" ? o.source_doc_id : "";
    const pageCount = pagesById.get(docId);
    if (!text || pageCount == null || LEAVE_OUT.test(text)) continue;
    const page = Number(o.source_page);
    if (Number.isInteger(page) && (page < 1 || (pageCount > 0 && page > pageCount))) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text,
      source_doc_id: docId,
      source_page: Number.isInteger(page) ? page : null,
    });
    if (out.length >= ABOUT_MAX_ITEMS) break;
  }
  return out;
}

const LEADS = [
  "doesn't like",
  "does not like",
  "loves",
  "likes",
  "enjoys",
  "dislikes",
  "prefers",
  "wants",
  "needs",
  "lives",
  "works",
  "communicates",
  "uses",
  "gets upset",
  "is calmed",
];

/** Split "Loves running…" into a bold lead ("Loves") and the rest. */
export function boldLead(text: string): { lead: string; rest: string } {
  const lower = text.toLowerCase();
  const hit = LEADS.find((l) => lower.startsWith(`${l} `));
  return hit
    ? { lead: text.slice(0, hit.length), rest: text.slice(hit.length) }
    : { lead: "", rest: text };
}

/** "PCSP p. 3" — the small grey source under a bullet. */
export function sourceLabel(
  item: AboutItem,
  docs: readonly { id: string; type: string | null }[],
): string {
  const doc = docs.find((d) => d.id === item.source_doc_id);
  const kind = doc ? docKindLabel(doc.type) : "Document";
  const label = kind.charAt(0).toUpperCase() + kind.slice(1);
  return item.source_page ? `${label} p. ${item.source_page}` : label;
}

/** "Summary from PCSP, BSP, face sheet" for the card footer. */
export function summarySources(
  items: readonly AboutItem[],
  docs: readonly { id: string; type: string | null }[],
): string {
  const kinds: string[] = [];
  for (const i of items) {
    const doc = docs.find((d) => d.id === i.source_doc_id);
    const k = doc ? docKindLabel(doc.type) : null;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  return kinds.length ? `Summary from ${kinds.join(", ")}` : "Summary";
}

/** A PCSP, BSP or face sheet uploaded after approval that the summary wasn't drafted from. */
export function hasNewKeyDocs(
  approved: { approvedAt: string; basedOn: readonly string[] },
  docs: readonly { id: string; type: string | null; uploadedAt: string | null }[],
): boolean {
  return docs.some(
    (d) =>
      isKeyAboutDoc(d.type) &&
      !approved.basedOn.includes(d.id) &&
      !!d.uploadedAt &&
      Date.parse(d.uploadedAt) > Date.parse(approved.approvedAt),
  );
}
