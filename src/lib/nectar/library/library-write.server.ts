// Draft and settings writes behind the Knowledge base screens (N3), on the
// caller's own data client after library.functions.ts checked who is asking.
// Nothing here deletes a row or a file.

import type { Database } from "@/integrations/supabase/types";
import type { LibraryCaller } from "./access.server";
import { audienceColumns, audienceWarning } from "./audience";
import { INDEXABLE_COLUMNS } from "./index.server";
import { authoritativeKindForGroup } from "./library";
import type { CreateDraftInput, SaveDraftInput } from "./library-input";
import { activeMembers, loadToggles, NOT_FOUND, type Db } from "./library-data.server";
import {
  displayName,
  readUploadedText,
  typedFile,
  uploadedFile,
  type FileFields,
} from "./library-files.server";
import { isLibraryPathForOrg } from "./uploads";

const DOC_COLUMNS =
  `${INDEXABLE_COLUMNS}, library_group, library_status, required_slot, owner_name, review_due, audience_all, policy_assigned_users, parent_document_id, superseded_by` as const;

/** A library document version of this agency, or "Document not found." */
export async function loadDoc(db: Db, orgId: string, documentId: string) {
  const { data } = await db
    .from("nectar_documents")
    .select(DOC_COLUMNS)
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .eq("owner_kind", "company")
    .not("library_group", "is", null)
    .maybeSingle();
  if (!data) throw new Error(NOT_FOUND);
  return data;
}

export async function createDraft(caller: LibraryCaller, input: CreateDraftInput) {
  const { db, userId, orgId } = caller;
  const typed = input.text?.trim() ? await typedFile(db, orgId, input.title, input.text) : null;
  const file = typed ?? uploadedFile(orgId, input.upload!);
  const { data, error } = await db
    .from("nectar_documents")
    .insert({
      organization_id: orgId,
      owner_kind: "company",
      document_type: "other",
      title: input.title,
      library_group: input.group,
      library_status: "draft",
      required_slot: input.requiredSlot ?? null,
      owner_name: input.ownerName ?? null,
      review_due: input.reviewDue ?? null,
      authoritative_kind: authoritativeKindForGroup(input.group),
      source: "library",
      tags: ["library"],
      uploaded_by: userId,
      uploaded_by_name: await displayName(db, userId),
      ...(typed ?? { ...file, parse_status: "parsing" }),
    })
    .select("id, parse_status")
    .single();
  if (error || !data) throw new Error("Could not save the draft.");
  const read = typed ? null : await readUploadedText(db, data.id, file);
  if (input.resolvesQuestionId) {
    await db
      .from("nectar_questions")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", input.resolvesQuestionId)
      .eq("organization_id", orgId);
  }
  return {
    id: data.id,
    status: "draft" as const,
    parseStatus: read?.parse_status ?? data.parse_status,
  };
}

export async function saveDraft(caller: LibraryCaller, input: SaveDraftInput) {
  const { db, orgId } = caller;
  const doc = await loadDoc(db, orgId, input.documentId);
  if (doc.library_status !== "draft") {
    throw new Error("Only a draft can be edited. Publish a new version instead.");
  }
  const title = input.title ?? doc.title;
  const patch: Database["public"]["Tables"]["nectar_documents"]["Update"] = { title };
  if (input.group) {
    patch.library_group = input.group;
    patch.authoritative_kind = authoritativeKindForGroup(input.group);
  }
  if (input.requiredSlot !== undefined) patch.required_slot = input.requiredSlot;
  if (input.ownerName !== undefined) patch.owner_name = input.ownerName;
  if (input.reviewDue !== undefined) patch.review_due = input.reviewDue;
  let upload: FileFields | null = null;
  if (input.text !== undefined) {
    const ownTxt = doc.mime_type === "text/plain" && isLibraryPathForOrg(doc.storage_path, orgId);
    Object.assign(
      patch,
      await typedFile(db, orgId, title, input.text, ownTxt ? doc.storage_path : undefined),
    );
  } else if (input.upload) {
    upload = uploadedFile(orgId, input.upload);
    Object.assign(patch, upload, { parse_status: "parsing" });
  }
  const { error } = await db.from("nectar_documents").update(patch).eq("id", doc.id);
  if (error) throw new Error("Could not save the draft.");
  const read = upload ? await readUploadedText(db, doc.id, upload) : null;
  return {
    id: doc.id,
    status: "draft" as const,
    parseStatus: read?.parse_status ?? patch.parse_status ?? null,
  };
}

/** Who it's for: all team members, or only the checked ones (active members of this agency). */
export async function setAudience(
  caller: LibraryCaller,
  documentId: string,
  audienceAll: boolean,
  userIds: string[],
) {
  const { db, orgId } = caller;
  const doc = await loadDoc(db, orgId, documentId);
  if (doc.superseded_by) throw new Error("Open the current version to change who it's for.");
  const memberIds = (await activeMembers(db, orgId)).map((m) => m.userId);
  const cols = audienceColumns(audienceAll ? { all: true } : { all: false, userIds }, memberIds);
  const { error } = await db.from("nectar_documents").update(cols).eq("id", doc.id);
  if (error) throw new Error("Could not save who it's for.");
  return {
    id: doc.id,
    audienceAll: cols.audience_all,
    userIds: cols.policy_assigned_users,
    warning: audienceWarning(cols),
  };
}

/** The two agency answers on the Required policies tab. */
export async function setAgencyToggles(
  caller: LibraryCaller,
  toggles: { providesTransportation?: boolean; managesClientMoney?: boolean },
) {
  const patch: { provides_transportation?: boolean; manages_client_money?: boolean } = {};
  if (toggles.providesTransportation !== undefined) {
    patch.provides_transportation = toggles.providesTransportation;
  }
  if (toggles.managesClientMoney !== undefined) {
    patch.manages_client_money = toggles.managesClientMoney;
  }
  if (Object.keys(patch).length === 0) return loadToggles(caller.db, caller.orgId);
  const { data, error } = await caller.db
    .from("organizations")
    .update(patch)
    .eq("id", caller.orgId)
    .select("provides_transportation, manages_client_money")
    .maybeSingle();
  if (error || !data) throw new Error("Could not save your agency's answers.");
  return data;
}
