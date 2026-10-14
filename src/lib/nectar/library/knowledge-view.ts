// What the Knowledge base screens say (N4, worded as in the demo). Pure: no
// Supabase, no aliases, so node --test can import it.

import { denverYmdFromInstant } from "../../denver-date.ts";
import { LIBRARY_GROUP_LABEL, type LibraryGroup } from "./library.ts";
import type { ReviewCell } from "./reviews.ts";
import { SLOT_STATUS_LABEL, type SlotStatus } from "./slots.ts";

export type ChipTone = "published" | "draft" | "past_review" | "missing" | "archived" | "state";
export interface Chip {
  label: string;
  tone: ChipTone;
}

/** A library document's chip: Loaded by PI (state rules), Archived, Draft, Past review or Published. */
export function documentChip(doc: { kind?: string; status: string; pastReview?: boolean }): Chip {
  if (doc.kind === "state_rule") return { label: "Loaded by PI", tone: "state" };
  if (doc.status === "archived") return { label: "Archived", tone: "archived" };
  if (doc.status === "draft") return { label: "Draft", tone: "draft" };
  if (doc.pastReview) return { label: "Past review", tone: "past_review" };
  return { label: "Published", tone: "published" };
}

/** A required-policy slot's chip: Missing, Draft, Published or Past review. */
export function slotChip(status: SlotStatus): Chip {
  return { label: SLOT_STATUS_LABEL[status], tone: status };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(ymd: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? { year: m[1]!, month, day: Number(m[3]) } : null;
}

/** "Mar 1, 2027" for a calendar day (YYYY-MM-DD); "" when there is none. */
export function formatDay(ymd: string | null | undefined): string {
  const p = parts(ymd);
  return p ? `${p.month} ${p.day}, ${p.year}` : "";
}

/** "Mar 1" for a calendar day. */
export function formatShortDay(ymd: string | null | undefined): string {
  const p = parts(ymd);
  return p ? `${p.month} ${p.day}` : "";
}

/** The Denver calendar day of a timestamp, as "Oct 3, 2026" (or "Oct 3" when short). */
export function formatInstant(iso: string | null | undefined, short = false): string {
  const ymd = denverYmdFromInstant(iso ?? null);
  return short ? formatShortDay(ymd) : formatDay(ymd);
}

export function groupLabel(group: string | null | undefined): string {
  return LIBRARY_GROUP_LABEL[group as LibraryGroup] ?? "Library";
}

export function documentCount(count: number): string {
  return `${count} ${count === 1 ? "document" : "documents"}`;
}

export type SlotRef = { code: string; label: string } | null;

/** The line under a document's name in the Library tab. */
export function slotLine(doc: { kind?: string; slot: SlotRef }): string {
  if (doc.kind === "state_rule") return "Read-only, kept current by PI";
  return doc.slot ? `Required: ${doc.slot.code} ${doc.slot.label}` : "Not a required policy";
}

export function reviewDueLabel(reviewDue: string | null | undefined): string {
  return reviewDue ? `Review ${formatDay(reviewDue)}` : "";
}

/** "N of M reviewed" (M = the people it's for), "(selected people)" when not everyone. */
export function reviewedLabel(
  reviewed: { reviewed: number; total: number } | null,
  audienceAll: boolean | null,
): string {
  if (!reviewed) return "";
  const who = audienceAll === false ? " (selected people)" : "";
  return `${reviewed.reviewed} of ${reviewed.total} reviewed${who}`;
}

/** The document view's meta line: group · version · owner · next review · slot. */
export function documentMeta(doc: {
  group: string | null;
  version: number;
  owner: string | null;
  reviewDue: string | null;
  slot: SlotRef;
}): string {
  const out = [`${groupLabel(doc.group)}`, `v${doc.version}`];
  if (doc.owner) out.push(`Owner: ${doc.owner}`);
  if (doc.reviewDue) out.push(`Next review ${formatDay(doc.reviewDue)}`);
  if (doc.slot) out.push(`Fills ${doc.slot.code} ${doc.slot.label}`);
  return out.join(" · ");
}

export const STATE_RULE_VIEW_NOTE =
  "Loaded by PI for every agency and kept current. Agencies can read it but not change it.";

/** The note under the meta line: drafts, past review, archived and replaced versions. */
export function documentNote(doc: {
  status: string;
  pastReview: boolean;
  superseded: boolean;
}): string | null {
  if (doc.superseded) {
    return "This is an older version. A newer version replaced it, so team members and Nectar use that one.";
  }
  if (doc.status === "archived") return "Archived. Team members and Nectar no longer see it.";
  if (doc.status === "draft")
    return "Draft. Nectar and team members can't see it until you publish it.";
  if (doc.pastReview) {
    return "The review date has passed. Publish a new version, or publish the same text again to confirm it.";
  }
  return null;
}

/** Why a version shows no sections. */
export function noSectionsNote(parseStatus: string | null | undefined): string {
  if (parseStatus === "no_text") {
    return "No readable text. Nectar can't use this file. Upload a PDF or Word file with selectable text, or type the text.";
  }
  if (parseStatus === "failed")
    return "The file could not be read. Upload it again, or type the text.";
  if (parseStatus === "parsing" || parseStatus === "pending") return "Reading the file…";
  return "This version has no text yet.";
}

export type CellTone = "ok" | "warn" | "muted";

/** A Reviews tab cell: "Reviewed Oct 3", "Needs review" or "Not for them". */
export function matrixCell(cell: ReviewCell): { label: string; tone: CellTone } {
  if (cell.status === "reviewed") {
    return { label: `Reviewed ${formatInstant(cell.reviewedAt, true)}`, tone: "ok" };
  }
  if (cell.status === "needs_review") return { label: "Needs review", tone: "warn" };
  return { label: "Not for them", tone: "muted" };
}

/** A person's line in the document view's "Reviewed vN" panel: "Oct 3" or "Needs review". */
export function personReview(cell: ReviewCell): { label: string; tone: CellTone } {
  if (cell.status === "reviewed")
    return { label: formatInstant(cell.reviewedAt, true), tone: "ok" };
  return cell.status === "needs_review"
    ? { label: "Needs review", tone: "warn" }
    : { label: "Not for them", tone: "muted" };
}

/** A printable record line's status. */
export function recordStatus(reviewedAt: string | null): string {
  return reviewedAt ? `Reviewed ${formatInstant(reviewedAt)}` : "Not reviewed yet";
}

/** A version's note in the Versions panel. */
export function versionNote(v: {
  library_status: string;
  superseded_at: string | null;
  archived_at: string | null;
}): string {
  if (v.superseded_at) return `Replaced ${formatInstant(v.superseded_at)}`;
  if (v.library_status === "archived") return `Archived ${formatInstant(v.archived_at)}`.trim();
  return v.library_status === "draft" ? "Draft" : "Published";
}

export function requiredSummary(current: number, required: number): string {
  return `${current} of ${required} required policies published and current`;
}

/** Applicable slots with no document at all ("Required policies (N missing)"). */
export function missingCount(
  rows: ReadonlyArray<{ applies: boolean; status: SlotStatus }>,
): number {
  return rows.filter((r) => r.applies && r.status === "missing").length;
}

/** Text a new draft starts with when it fills a required slot ("Add"). */
export const SLOT_DRAFT_TEXT =
  "Purpose\nWhat this policy covers.\n\nWhat team members do\n[Write the steps here]";

/** Text a new draft starts with from a question Nectar couldn't answer ("Add to library"). */
export function questionDraftText(question: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  return `Purpose\nAnswers the question: "${q}"\n\nWhat team members do\n[Write the steps here]`;
}

/** Printing a review record prints only the record (a print stylesheet; screen shows the panel). */
export const REVIEW_RECORD_PRINT_ID = "knowledge-review-record-print";
export const REVIEW_RECORD_PRINT_CSS = [
  `@media screen { #${REVIEW_RECORD_PRINT_ID} { display: none; } }`,
  "@media print {",
  `  body > *:not(#${REVIEW_RECORD_PRINT_ID}) { display: none !important; }`,
  `  #${REVIEW_RECORD_PRINT_ID} { display: block !important; color: #000; font-size: 12pt; }`,
  `  #${REVIEW_RECORD_PRINT_ID} li { break-inside: avoid; }`,
  "}",
].join("\n");
