// Shared reads for the Knowledge base library (N3), on the caller's own data
// client. Team member names: organization_members and profiles are read
// separately and joined here (there is no foreign key between them to embed).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isReviewable, REVIEW_GROUPS, type MatrixMember, type ReviewRow } from "./reviews";
import type { AgencyToggles, SlotDef } from "./slots";
import { LIBRARY_BUCKET } from "./uploads";

export type Db = SupabaseClient<Database>;

export const NOT_FOUND = "Document not found.";

export const ROW_COLUMNS =
  "id, title, library_group, library_status, required_slot, owner_name, uploaded_by_name, review_due, version, parent_document_id, superseded_by, audience_all, policy_assigned_users, parse_status, file_name, created_at, updated_at" as const;

/** Active team members with display names: two queries, joined here. */
export async function activeMembers(db: Db, orgId: string): Promise<MatrixMember[]> {
  const { data: members, error } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("active", true);
  if (error) throw new Error("Could not load your team members.");
  const ids = [...new Set((members ?? []).map((m) => m.user_id))];
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("id, full_name, email").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = byId.get(id);
    return { userId: id, name: p?.full_name?.trim() || p?.email || "Team member" };
  });
}

/** Review rows for these documents (optionally one person's), paged past the 1,000-row cap. */
export async function loadReviews(
  db: Db,
  docIds: readonly string[],
  userId?: string,
): Promise<ReviewRow[]> {
  const out: ReviewRow[] = [];
  for (let i = 0; i < docIds.length; i += 100) {
    const ids = docIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      let q = db
        .from("policy_signatures")
        .select("id, document_id, document_version, user_id, signed_at")
        .in("document_id", ids);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q.order("id").range(from, from + 999);
      if (error) throw new Error("Could not load reviews.");
      out.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }
  return out;
}

export async function loadSlots(db: Db): Promise<SlotDef[]> {
  const { data, error } = await db
    .from("required_policy_slots")
    .select("id, code, label, applies_when, position")
    .order("position");
  if (error) throw new Error("Could not load the required policies.");
  return data ?? [];
}

export async function loadToggles(db: Db, orgId: string): Promise<AgencyToggles> {
  const { data, error } = await db
    .from("organizations")
    .select("provides_transportation, manages_client_money")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) throw new Error("Could not load your agency settings.");
  return data;
}

/** Current versions of the agency's library documents (or only published policies and procedures). */
export async function currentRows(db: Db, orgId: string, opts: { reviewable?: boolean } = {}) {
  let q = db
    .from("nectar_documents")
    .select(ROW_COLUMNS)
    .eq("organization_id", orgId)
    .eq("owner_kind", "company")
    .not("library_group", "is", null)
    .is("superseded_by", null);
  if (opts.reviewable)
    q = q.eq("library_status", "published").in("library_group", [...REVIEW_GROUPS]);
  const { data, error } = await q.order("title");
  if (error) throw new Error("Could not load the Knowledge base.");
  return (data ?? []).filter((r) => !opts.reviewable || isReviewable(r.library_group));
}

/** A 30-minute link to a document's file, readable only if storage lets this caller read it. */
export async function signedFileUrl(
  db: Db,
  path: string | null,
  bucket: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(bucket ?? LIBRARY_BUCKET).createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}
