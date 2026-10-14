// "Mark as reviewed" and the review views (N3, Decision 4), on the caller's
// own data client after library.functions.ts checked who is asking.

import { isVisibleToMember } from "./audience";
import type { LibraryCaller } from "./access.server";
import {
  activeMembers,
  currentRows,
  loadReviews,
  NOT_FOUND,
  ROW_COLUMNS,
  signedFileUrl,
  type Db,
} from "./library-data.server";
import {
  isDuplicateReview,
  isReviewable,
  planReview,
  REVIEW_REFUSAL_MESSAGE,
  reviewHashInput,
  reviewInsertRow,
  reviewMatrix,
  reviewOf,
  staffRecord,
} from "./reviews";
import { splitDocumentSections } from "./typed-sections";

/** Reviews tab: team members × published policies and procedures. */
export async function readReviewMatrix(db: Db, orgId: string) {
  const [docs, members] = await Promise.all([
    currentRows(db, orgId, { reviewable: true }),
    activeMembers(db, orgId),
  ]);
  const matrix = reviewMatrix(
    docs,
    members,
    await loadReviews(
      db,
      docs.map((d) => d.id),
    ),
  );
  return {
    documents: matrix.documents.map((d) => ({
      id: d.id,
      title: d.title,
      version: d.version,
      counts: d.counts,
    })),
    rows: matrix.rows,
  };
}

/** One person's printable record; a team member's own record is their Policies list. */
export async function readStaffRecord(db: Db, orgId: string, userId: string) {
  const [docs, members] = await Promise.all([
    currentRows(db, orgId, { reviewable: true }),
    activeMembers(db, orgId),
  ]);
  const person = members.find((m) => m.userId === userId);
  if (!person) throw new Error("Team member not found.");
  const reviews = await loadReviews(
    db,
    docs.map((d) => d.id),
    userId,
  );
  return { person, policies: staffRecord(userId, docs, reviews) };
}

/** A team member opening a published document meant for them: its sections and their review. */
export async function readPolicyForMember(
  db: Db,
  orgId: string,
  documentId: string,
  userId: string,
) {
  const { data: doc } = await db
    .from("nectar_documents")
    .select(`${ROW_COLUMNS}, raw_text, storage_path, storage_bucket, mime_type`)
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .is("superseded_by", null)
    .not("library_group", "is", null)
    .maybeSingle();
  if (!doc || !isVisibleToMember(doc, userId)) throw new Error(NOT_FOUND);
  const reviews = isReviewable(doc.library_group) ? await loadReviews(db, [doc.id], userId) : [];
  return {
    id: doc.id,
    title: doc.title,
    version: doc.version,
    group: doc.library_group,
    reviewable: isReviewable(doc.library_group),
    sections: splitDocumentSections(doc.raw_text ?? "", doc.mime_type),
    reviewedAt: reviewOf(doc, userId, reviews)?.signed_at ?? null,
    fileUrl: await signedFileUrl(db, doc.storage_path, doc.storage_bucket),
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "Mark as reviewed": one dated row per person per version; a second call changes nothing. */
export async function markReviewed({ db, userId, orgId }: LibraryCaller, documentId: string) {
  const { data: doc } = await db
    .from("nectar_documents")
    .select(
      "id, version, library_group, library_status, superseded_by, audience_all, policy_assigned_users, raw_text, storage_path",
    )
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!doc) throw new Error(NOT_FOUND);
  const plan = planReview(doc, userId, await loadReviews(db, [doc.id], userId));
  if (!plan.ok) throw new Error(REVIEW_REFUSAL_MESSAGE[plan.reason]);
  const result = (reviewedAt: string, alreadyReviewed: boolean) => ({
    documentId: doc.id,
    version: doc.version,
    reviewedAt,
    alreadyReviewed,
  });
  if (plan.already) return result(plan.already.signed_at, true);
  const { data: person } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const row = reviewInsertRow({
    organizationId: orgId,
    doc,
    user: { id: userId, name: person?.full_name?.trim() || null, email: person?.email ?? null },
    contentHash: await sha256Hex(reviewHashInput(doc)),
    signedAt: new Date().toISOString(),
  });
  const { error } = await db.from("policy_signatures").insert(row);
  if (isDuplicateReview(error)) {
    const again = planReview(doc, userId, await loadReviews(db, [doc.id], userId));
    if (again.ok && again.already) return result(again.already.signed_at, true);
  }
  if (error) throw new Error("Could not save your review.");
  return result(row.signed_at, false);
}
