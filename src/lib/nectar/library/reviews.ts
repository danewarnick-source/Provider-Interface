// "Mark as reviewed" (N3, Decision 4). Pure: no Supabase, no aliases, so
// node --test can import it.
//
// Each published policy has one "Mark as reviewed" button for the people it
// is for. A review is a dated policy_signatures row for one person and one
// version: document_id + document_version + user_id. A new version is a new
// document row, so it has no reviews and asks those people again. Reviewing
// the same version twice changes nothing.

import { isInAudience, type AudienceFields } from "./audience.ts";

export const REVIEW_STATEMENT = "I have reviewed this version.";

/**
 * Library groups whose published documents ask the people they are for to
 * review them: Agency policies and Procedures and forms. Reference documents
 * are for information only; state rules come from PI.
 */
export const REVIEW_GROUPS: readonly string[] = ["agency", "procedures"];

export function isReviewable(group: string | null | undefined): boolean {
  return !!group && REVIEW_GROUPS.includes(group);
}

export interface ReviewRow {
  document_id: string;
  document_version: number;
  user_id: string;
  signed_at: string;
}

export interface ReviewDoc extends AudienceFields {
  id: string;
  version: number;
}

export type ReviewCell =
  | { status: "reviewed"; reviewedAt: string }
  | { status: "needs_review" }
  | { status: "not_for_them" };

/** The person's review of exactly this version, if any (the earliest one). */
export function reviewOf(
  doc: Pick<ReviewDoc, "id" | "version">,
  userId: string,
  reviews: readonly ReviewRow[],
): ReviewRow | null {
  let found: ReviewRow | null = null;
  for (const r of reviews) {
    if (r.document_id !== doc.id || r.document_version !== doc.version || r.user_id !== userId)
      continue;
    if (!found || r.signed_at < found.signed_at) found = r;
  }
  return found;
}

export function reviewCell(
  doc: ReviewDoc,
  userId: string,
  reviews: readonly ReviewRow[],
): ReviewCell {
  if (!isInAudience(doc, userId)) return { status: "not_for_them" };
  const review = reviewOf(doc, userId, reviews);
  return review ? { status: "reviewed", reviewedAt: review.signed_at } : { status: "needs_review" };
}

/** "N of M reviewed": M = the active team members the version is for. */
export function reviewCounts(
  doc: ReviewDoc,
  activeMemberIds: readonly string[],
  reviews: readonly ReviewRow[],
): { reviewed: number; total: number } {
  const forThem = activeMemberIds.filter((id) => isInAudience(doc, id));
  return {
    reviewed: forThem.filter((id) => reviewOf(doc, id, reviews)).length,
    total: forThem.length,
  };
}

export interface MatrixMember {
  userId: string;
  name: string;
}

/** Team members × published policies; each cell Reviewed (date) / Needs review / Not for them. */
export function reviewMatrix<D extends ReviewDoc>(
  docs: readonly D[],
  members: readonly MatrixMember[],
  reviews: readonly ReviewRow[],
) {
  const memberIds = members.map((m) => m.userId);
  return {
    documents: docs.map((d) => ({ ...d, counts: reviewCounts(d, memberIds, reviews) })),
    rows: [...members]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        ...m,
        cells: docs.map((d) => ({ documentId: d.id, ...reviewCell(d, m.userId, reviews) })),
      })),
  };
}

/** One person's record: every published policy meant for them, with the reviewed date or null. */
export function staffRecord<D extends ReviewDoc & { title: string }>(
  userId: string,
  docs: readonly D[],
  reviews: readonly ReviewRow[],
) {
  return docs
    .filter((d) => isInAudience(d, userId))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((d) => ({
      documentId: d.id,
      title: d.title,
      version: d.version,
      reviewedAt: reviewOf(d, userId, reviews)?.signed_at ?? null,
    }));
}

export type ReviewRefusal = "not_published" | "not_reviewable" | "not_for_you";

export const REVIEW_REFUSAL_MESSAGE: Record<ReviewRefusal, string> = {
  not_published: "Only a published version can be marked as reviewed.",
  not_reviewable: "Only policies and procedures are marked as reviewed.",
  not_for_you: "This policy isn't meant for you.",
};

/** Whether this person may mark this version reviewed, and whether they already did. */
export function planReview(
  doc: ReviewDoc & {
    library_status: string;
    superseded_by: string | null;
    library_group: string | null;
  },
  userId: string,
  existing: readonly ReviewRow[],
): { ok: true; already: ReviewRow | null } | { ok: false; reason: ReviewRefusal } {
  if (doc.library_status !== "published" || doc.superseded_by)
    return { ok: false, reason: "not_published" };
  if (!isReviewable(doc.library_group)) return { ok: false, reason: "not_reviewable" };
  if (!isInAudience(doc, userId)) return { ok: false, reason: "not_for_you" };
  return { ok: true, already: reviewOf(doc, userId, existing) };
}

/** The policy_signatures row a review writes. typed_signature stays empty. */
export function reviewInsertRow(input: {
  organizationId: string;
  doc: Pick<ReviewDoc, "id" | "version">;
  user: { id: string; name: string | null; email: string | null };
  contentHash: string;
  signedAt: string;
}) {
  return {
    organization_id: input.organizationId,
    document_id: input.doc.id,
    document_version: input.doc.version,
    user_id: input.user.id,
    signer_full_name: input.user.name,
    signer_email: input.user.email,
    signed_at: input.signedAt,
    attestation_statement: REVIEW_STATEMENT,
    consent_accepted: true,
    content_version: String(input.doc.version),
    content_hash: input.contentHash,
  };
}

/** What a review's content hash covers: the version's text, or its file when it has no text. */
export function reviewHashInput(doc: {
  raw_text: string | null;
  storage_path: string | null;
}): string {
  const text = (doc.raw_text ?? "").trim();
  return text ? text : `file:${doc.storage_path ?? ""}`;
}

/** Postgres unique_violation: the one-review-per-version index refused a second review. */
export function isDuplicateReview(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "23505";
}
