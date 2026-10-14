// Sections of text typed in the Knowledge base's New document box (N4).
// Pure: no Supabase, no aliases, so node --test can import it.
//
// The box asks for each section's heading on its own line, with a blank line
// between sections. sections.ts finds headings by their shape (Markdown,
// numbered, Title Case), so a typed heading in sentence case ("What team
// members do") would be missed there. Typed text and plain text files are
// split into these blocks instead; every other file keeps splitSections.

import { chunkText, splitSections, type TextSection } from "./sections.ts";

const MAX_HEADING_CHARS = 100;
const MAX_HEADING_WORDS = 12;

/**
 * A block's first line is its heading when it is short, starts like a title
 * and is not a sentence: no closing punctuation, not a list item, and the
 * next line doesn't carry on the same sentence.
 */
export function isTypedHeading(line: string, nextLine?: string): boolean {
  const text = line.trim();
  if (!text || text.length > MAX_HEADING_CHARS) return false;
  if (!/^[A-Z0-9§("“']/.test(text)) return false;
  if (/[.,;!?]$/.test(text)) return false;
  if (/^[-*•]\s/.test(text)) return false;
  if (text.split(/\s+/).length > MAX_HEADING_WORDS) return false;
  return !(nextLine !== undefined && /^[a-z]/.test(nextLine.trim()));
}

function cleanHeading(line: string): string {
  return line.trim().replace(/:$/, "").trim();
}

function blocksOf(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);
}

/**
 * Typed text as sections. A block led by a heading is one section; a heading
 * alone in its block heads the next block (two in a row join: "Part A —
 * Intro"); a block with no heading continues the section before it. Long
 * sections are cut into ~1,200-character chunks under the same heading.
 */
export function splitTypedSections(text: string): TextSection[] {
  const raw: Array<{ heading: string | null; body: string }> = [];
  let pending: string | null = null;
  const push = (heading: string | null, body: string) => {
    const last = raw[raw.length - 1];
    if (heading === null && last) last.body = `${last.body}\n\n${body}`;
    else raw.push({ heading, body });
  };
  for (const [first, ...rest] of blocksOf(text ?? "")) {
    const heading = isTypedHeading(first!, rest[0]) ? cleanHeading(first!) : null;
    if (heading !== null && rest.length === 0) {
      pending = pending ? `${pending} — ${heading}` : heading;
      continue;
    }
    if (heading !== null) {
      push(pending ? `${pending} — ${heading}` : heading, rest.join("\n"));
    } else if (pending !== null) {
      push(pending, [first, ...rest].join("\n"));
    } else {
      push(null, [first, ...rest].join("\n"));
    }
    pending = null;
  }
  if (pending !== null) push(null, pending);
  const out: TextSection[] = [];
  for (const section of raw) {
    for (const body of chunkText(section.body)) {
      out.push({ heading: section.heading, body, position: out.length });
    }
  }
  return out;
}

/** Text the Knowledge base saved as a plain text file (typed, or an uploaded .txt / .md). */
export function isTypedText(mimeType: string | null | undefined): boolean {
  return /^text\/(plain|markdown)\b/i.test(mimeType ?? "");
}

/**
 * The sections of a document version. Typed text uses its blocks; text with
 * Markdown headings, and every other file, uses splitSections (sections.ts).
 */
export function splitDocumentSections(
  text: string,
  mimeType: string | null | undefined,
): TextSection[] {
  const clean = text ?? "";
  if (!isTypedText(mimeType) || /^#{1,6}\s+\S/m.test(clean)) return splitSections(clean);
  return splitTypedSections(clean);
}
