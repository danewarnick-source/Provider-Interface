// Which lines of a document are headings (N3). Pure: no Supabase, no aliases,
// so node --test can import it. sections.ts builds the sections from them.
//
// Headings: Markdown "#" lines, numbered headings like "4.2 Staff Training",
// "Article 3 ..." lines, and short lines in Title Case or capitals standing
// on their own.
//
// PDF text stored before N3 has no line breaks. In such a line, numbered
// headings are found inline: "1.17 Personnel Policies and Procedures." right
// after a sentence end, page number or capitals title, in increasing order
// (so a cross-reference to an earlier section is not a heading). The capitals
// title in front of a chapter's first heading is split out the same way.

/** A heading line: its text, its level (1 = chapter) and whether it is numbered ("4.2 ..."). */
export interface Heading {
  text: string;
  level: number;
  numbered: boolean;
}

const SMALL_WORDS = new Set(
  "a an and as at but by for from in into nor of on or per the to via vs with within without under over than".split(
    " ",
  ),
);
const CAPS_TOKEN = /^[^a-z]*[A-Z][^a-z]*$/;
const CONNECTOR = /^[-–—&/:]+$/;
const BULLET = /^([-*•◦▪‣]|\(?[a-z0-9]{1,3}\))\s/i;
const INLINE_HEADING = /(\d{1,2}(?:\.\d{1,3}){1,3})\.?\s+([A-Z][^.!?\n]{1,100}?)\.(?=\s|$)/g;

/** Every word that matters starts with a capital (or is a number): a title, not a sentence. */
export function isTitleLike(text: string, maxWords = 14): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > maxWords) return false;
  let significant = 0;
  for (const [i, raw] of words.entries()) {
    const word = raw.replace(/^[("“'‘[]+/, "");
    const letters = word.replace(/[^A-Za-z]/g, "");
    if (!letters) continue;
    if (i > 0 && letters === letters.toLowerCase() && SMALL_WORDS.has(letters)) continue;
    if (!/^[A-Z0-9]/.test(word)) return false;
    significant += 1;
  }
  return significant > 0;
}

function numberParts(num: string): number[] {
  return num.split(".").filter(Boolean).map(Number);
}

function isAfter(next: number[], last: number[] | null): boolean {
  if (!last) return true;
  for (let i = 0; i < Math.max(next.length, last.length); i++) {
    const a = next[i] ?? -1;
    const b = last[i] ?? -1;
    if (a !== b) return a > b;
  }
  return false;
}

/** A heading starts a line, or follows a sentence end, a page number or a capitals title. */
function canStartHeading(before: string): boolean {
  const token = before.trimEnd().split(/\s+/).pop() ?? "";
  return !token || /[.;:)\]”"]$/.test(token) || /^\d+$/.test(token) || CAPS_TOKEN.test(token);
}

/** The capitals title right before a numbered heading ("Article 3 BEHAVIOR CONSULTATION I - ..."). */
function chapterTitleBefore(before: string): string | null {
  const tokens = before.trimEnd().split(/\s+/).filter(Boolean);
  const run: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    if (CAPS_TOKEN.test(token) || CONNECTOR.test(token) || /^\d+$/.test(token)) {
      if (/[.;]$/.test(token)) break;
      run.unshift(token);
      if (run.length > 16) return null;
      continue;
    }
    const numbered = run[0] !== undefined && /^\d+$/.test(run[0]);
    if (numbered && /^(Article|Chapter|Part|Section)$/.test(token)) run.unshift(token);
    break;
  }
  while (run.length && !/[A-Za-z]/.test(run[0]!)) run.shift();
  if (run.filter((t) => /[A-Z]{2,}/.test(t)).length < 2) return null;
  const title = run.join(" ");
  return title.length <= 140 ? title : null;
}

/** Puts inline numbered headings (and the chapter title before one) on their own lines. */
export function splitInlineHeadings(line: string, state: { last: number[] | null }): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (const match of line.matchAll(INLINE_HEADING)) {
    const start = match.index ?? 0;
    if (start > 0 && !/\s/.test(line[start - 1]!)) continue;
    if (!canStartHeading(line.slice(0, start)) || !isTitleLike(match[2]!)) continue;
    const parts = numberParts(match[1]!);
    if (!isAfter(parts, state.last)) continue;
    state.last = parts;
    const before = line.slice(cursor, start).trimEnd();
    const chapter = chapterTitleBefore(before);
    const body = chapter ? before.slice(0, before.length - chapter.length).trim() : before.trim();
    if (body) out.push(body, "");
    if (chapter) out.push(chapter, "");
    out.push(`${match[1]} ${match[2]!.trim()}.`);
    cursor = start + match[0].length;
  }
  if (cursor === 0) return [line];
  const rest = line.slice(cursor).trim();
  if (rest) out.push(rest);
  return out;
}

function stripEnd(text: string): string {
  return text.replace(/[.:]+$/, "").trim();
}

/**
 * The heading on this line, or null. `prev` and `next` are the lines around
 * it (next = the next non-blank one); a Title Case line counts only when it
 * stands on its own and the text after it starts a new sentence.
 */
export function headingOf(
  line: string,
  prev: string | undefined,
  next: string | undefined,
  prevHeading: boolean,
): Heading | null {
  const md = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
  if (md) {
    return {
      text: stripEnd(md[2]!.replace(/[*_]{2}/g, "")),
      level: md[1]!.length,
      numbered: false,
    };
  }
  const text = line.replace(/^(\*\*|__)(.+?)\1:?$/, "$2");
  const numbered = /^(\d{1,3}(?:\.\d{1,3}){1,4})\.?\s+(.{1,110})$/.exec(text);
  if (numbered) {
    const title = stripEnd(numbered[2]!);
    if (!isTitleLike(title) || /[.!?]\s/.test(title)) return null;
    const level = numberParts(numbered[1]!).length;
    return { text: `${numbered[1]} ${title}`, level, numbered: true };
  }
  const article = /^(Article|Chapter|Part|Section)\s+[0-9IVXLC]+\b[.:]?\s*(.*)$/i.exec(text);
  if (article && text.length <= 140 && (!article[2] || isTitleLike(stripEnd(article[2]), 18))) {
    return { text: stripEnd(text), level: 1, numbered: false };
  }
  if (/^\d{1,2}[.)]?\s+[A-Z][^a-z]{2,80}$/.test(text) && /[A-Z]{3}/.test(text)) {
    return { text: stripEnd(text), level: 1, numbered: false };
  }
  if (BULLET.test(text) || text.length < 3 || text.length > 100 || /[,;.]$/.test(text)) return null;
  if (!/[A-Za-z]{3}/.test(text)) return null;
  const caps = !/[a-z]/.test(text);
  if (!isTitleLike(stripEnd(text), caps ? 12 : 10) || (!caps && text.length > 80)) return null;
  const standalone = prev === undefined || prev === "" || /[.:!?;]$/.test(prev) || prevHeading;
  if (!standalone || next === undefined || /^[a-z]/.test(next)) return null;
  return { text: stripEnd(text), level: caps ? 1 : 2, numbered: false };
}
