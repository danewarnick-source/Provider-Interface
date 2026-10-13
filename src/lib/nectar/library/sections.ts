// Split a document's text into the sections Nectar searches and cites (N3).
// Pure: no Supabase, no aliases, so node --test can import it.
//
// Sections start at headings (section-headings.ts). A chapter title with
// nothing under it is kept in front of the deeper headings after it, e.g.
// "Article 3 BEHAVIOR CONSULTATION I — 3.1 General Description". Sections
// longer than MAX_SECTION_CHARS, and text with no headings at all, are cut
// into ~1,200-character chunks on paragraph breaks, then sentence ends.

import { headingOf, splitInlineHeadings, type Heading } from "./section-headings.ts";

export const CHUNK_TARGET_CHARS = 1200;
export const MAX_SECTION_CHARS = 2400;
const MAX_HEADING_CHARS = 200;
const SMALL_TAIL_CHARS = 200;
const FOOTER_WORDS = /\b(page|effective|revised|rev|version|updated|confidential|copyright)\b|©/i;

export interface TextSection {
  heading: string | null;
  body: string;
  position: number;
}

function normalizeLines(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]/g, " ")
    .split("\n")
    .map((l) =>
      l
        .replace(/\.{4,}/g, " ")
        .replace(/ {2,}/g, " ")
        .trim(),
    );
  // Page headers and footers ("Page 3 of 10", "Effective 7/1/26 13", a bare
  // page number) repeat with only their numbers changing; they are not content.
  const footerLike = (l: string) =>
    l.length <= 60 && /\d/.test(l) && (!/[A-Za-z]/.test(l) || FOOTER_WORDS.test(l));
  const key = (l: string) => l.replace(/\d+/g, "#");
  const counts = new Map<string, number>();
  for (const l of lines.filter(footerLike)) counts.set(key(l), (counts.get(key(l)) ?? 0) + 1);
  return lines.filter((l) => !(footerLike(l) && (counts.get(key(l)) ?? 0) >= 3));
}

function splitWords(text: string, size: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (current && current.length + 1 + word.length > size) {
      out.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) out.push(current);
  return out;
}

/** ~target-size chunks on paragraph breaks, then sentence ends, then spaces. */
export function chunkText(
  text: string,
  target = CHUNK_TARGET_CHARS,
  max = MAX_SECTION_CHARS,
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const pieces: Array<{ text: string; sep: string }> = [];
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim());
  for (const para of paragraphs.filter(Boolean)) {
    if (para.length <= target) {
      pieces.push({ text: para, sep: "\n\n" });
      continue;
    }
    const sentences = para.split(/(?<=[.!?][)"”’]?)\s+(?=[A-Z0-9("“])/);
    const parts = sentences.flatMap((s) => (s.length <= max ? [s] : splitWords(s, target)));
    parts.forEach((s, i) => pieces.push({ text: s, sep: i === 0 ? "\n\n" : " " }));
  }
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.sep.length + piece.text.length > target) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}${piece.sep}${piece.text}` : piece.text;
  }
  const prev = chunks[chunks.length - 1];
  if (prev && current.length < SMALL_TAIL_CHARS && prev.length + current.length + 1 <= max) {
    chunks[chunks.length - 1] = `${prev} ${current}`;
  } else if (current) chunks.push(current);
  return chunks;
}

function clipHeading(heading: string): string {
  if (heading.length <= MAX_HEADING_CHARS) return heading;
  return `${heading.slice(0, MAX_HEADING_CHARS - 1).trimEnd()}…`;
}

/** The document's sections, in order. Empty text gives no sections. */
export function splitSections(text: string): TextSection[] {
  const state = { last: null as number[] | null };
  const lines = normalizeLines(text ?? "").flatMap((l) => splitInlineHeadings(l, state));
  const nextText: Array<string | undefined> = new Array(lines.length);
  for (let i = lines.length - 1, seen: string | undefined; i >= 0; i--) {
    nextText[i] = seen;
    if (lines[i]) seen = lines[i];
  }
  const raw: Array<{ heading: string | null; body: string }> = [];
  let context: Heading | null = null;
  let current = {
    heading: null as string | null,
    own: null as Heading | null,
    lines: [] as string[],
  };
  const flush = () => {
    const body = current.lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (body) raw.push({ heading: current.heading, body });
    // An empty chapter title leads the headings under it; an empty numbered
    // heading is a table of contents line, so the chapter context ends.
    else if (current.own) context = current.own.numbered ? null : current.own;
  };
  let prevHeading = false;
  lines.forEach((line, i) => {
    const prev = i > 0 ? lines[i - 1] : undefined;
    const heading = line ? headingOf(line, prev, nextText[i], prevHeading) : null;
    if (heading) {
      flush();
      if (context && heading.level <= context.level) context = null;
      const text = context ? `${context.text} — ${heading.text}` : heading.text;
      current = { heading: text, own: heading, lines: [] };
    } else current.lines.push(line);
    if (line) prevHeading = !!heading;
  });
  flush();
  const out: TextSection[] = [];
  for (const section of raw) {
    const heading = section.heading ? clipHeading(section.heading) : null;
    for (const body of chunkText(section.body)) out.push({ heading, body, position: out.length });
  }
  return out;
}
