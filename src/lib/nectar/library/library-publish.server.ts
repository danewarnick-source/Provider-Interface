// Publishing, new versions and archiving (N3), on the caller's own data client
// after library.functions.ts checked who is asking. Search is updated inside
// the same call (index.server.ts), so it is current when the call returns.
// A replaced version is archived with superseded_by; nothing is deleted.
// Logs carry ids only, never document text.

import { denverYmd } from "@/lib/denver-date";
import { loadNectarSettings } from "@/lib/nectar/engine/guard.server";
import type { LibraryCaller } from "./access.server";
import {
  embedPendingSections,
  indexLibraryBacklog,
  indexLibraryVersion,
  retireSections,
  type IndexableDocument,
} from "./index.server";
import { PUBLISH_EMBED_BUDGET_MS, shouldEmbed } from "./indexing";
import { authoritativeKindForGroup, chainRootId, defaultReviewDue } from "./library";
import type { NewVersionInput } from "./library-input";
import { displayName, readUploadedText, typedFile, uploadedFile } from "./library-files.server";
import { loadDoc } from "./library-write.server";

/** Puts a version in Nectar search, then catches up the agency's other documents in the time left. */
async function updateSearch({ db, orgId }: LibraryCaller, doc: IndexableDocument | null) {
  try {
    const settings = await loadNectarSettings(db, orgId);
    const opts = { embed: shouldEmbed(settings), deadline: Date.now() + PUBLISH_EMBED_BUDGET_MS };
    const own = doc ? await indexLibraryVersion(db, doc, opts) : { sections: 0, embedded: 0 };
    const otherDocuments = await indexLibraryBacklog(db, orgId, opts);
    const pending = await embedPendingSections(db, { organizationId: orgId }, opts);
    return { ok: true, sections: own.sections, embedded: own.embedded + pending, otherDocuments };
  } catch {
    console.error("[knowledge-base] search update failed", {
      organizationId: orgId,
      documentId: doc?.id ?? null,
    });
    return { ok: false, sections: 0, embedded: 0, otherDocuments: 0 };
  }
}

/** Draft → Published. The next review date defaults to a year from today. */
export async function publishDocument(caller: LibraryCaller, documentId: string) {
  const { db, orgId } = caller;
  const doc = await loadDoc(db, orgId, documentId);
  if (doc.library_status !== "draft") {
    throw new Error("Only a draft can be published. Use Publish new version instead.");
  }
  const reviewDue = doc.review_due ?? defaultReviewDue(denverYmd());
  const { error } = await db
    .from("nectar_documents")
    .update({
      library_status: "published",
      is_current: true,
      status: "current",
      review_due: reviewDue,
    })
    .eq("id", doc.id);
  if (error) throw new Error("Could not publish the document.");
  const search = await updateSearch(caller, doc);
  return { id: doc.id, status: "published" as const, reviewDue, search };
}

/**
 * A new published version from new text or a new file. The old version is
 * archived with superseded_by (kept, out of search); everyone the document is
 * for is asked to review the new version, since reviews belong to a version.
 */
export async function publishNewVersion(caller: LibraryCaller, input: NewVersionInput) {
  const { db, userId, orgId } = caller;
  const current = await loadDoc(db, orgId, input.documentId);
  if (current.superseded_by || current.library_status !== "published") {
    throw new Error("Only the published version gets a new version. Edit a draft instead.");
  }
  const title = input.title ?? current.title;
  const typed = input.text?.trim() ? await typedFile(db, orgId, title, input.text) : null;
  const file = typed ?? uploadedFile(orgId, input.upload!);
  const { data: next, error } = await db
    .from("nectar_documents")
    .insert({
      organization_id: orgId,
      owner_kind: "company",
      document_type: "other",
      title,
      library_group: current.library_group,
      library_status: "published",
      required_slot: current.required_slot,
      owner_name: input.ownerName !== undefined ? input.ownerName : current.owner_name,
      review_due: input.reviewDue ?? defaultReviewDue(denverYmd()),
      audience_all: current.audience_all,
      policy_assigned_users: current.policy_assigned_users,
      version: current.version + 1,
      parent_document_id: chainRootId(current),
      authoritative_kind: authoritativeKindForGroup(current.library_group),
      source: "library",
      tags: ["library"],
      uploaded_by: userId,
      uploaded_by_name: await displayName(db, userId),
      ...(typed ?? { ...file, parse_status: "parsing" }),
    })
    .select("id")
    .single();
  if (error || !next) throw new Error("Could not publish the new version.");
  const now = new Date().toISOString();
  const { error: oldErr } = await db
    .from("nectar_documents")
    .update({
      superseded_by: next.id,
      superseded_at: now,
      is_current: false,
      library_status: "archived",
      archived_at: now,
      archived_by: userId,
      status: "outdated",
    })
    .eq("id", current.id);
  if (oldErr)
    throw new Error("The new version is published, but the old one could not be archived.");
  await retireSections(db, { documentId: current.id });
  if (!typed) await readUploadedText(db, next.id, file);
  const fresh = await loadDoc(db, orgId, next.id);
  const search = await updateSearch(caller, fresh);
  return { id: next.id, version: fresh.version, status: "published" as const, search };
}

/** Archive, never delete: the row stays and its sections leave search. */
export async function archiveDocument(caller: LibraryCaller, documentId: string) {
  const { db, userId, orgId } = caller;
  const doc = await loadDoc(db, orgId, documentId);
  if (doc.superseded_by) throw new Error("Open the current version to archive this document.");
  if (doc.library_status !== "archived") {
    const now = new Date().toISOString();
    const { error } = await db
      .from("nectar_documents")
      .update({
        library_status: "archived",
        archived_at: now,
        archived_by: userId,
        is_current: false,
        status: "outdated",
      })
      .eq("id", doc.id);
    if (error) throw new Error("Could not archive the document.");
  }
  await retireSections(db, { documentId: doc.id });
  return { id: doc.id, status: "archived" as const };
}

/** Catches up Nectar search for the agency's published documents (the N3 backfill, embeddings left over). */
export function refreshLibraryIndex(caller: LibraryCaller) {
  return updateSearch(caller, null);
}
