// Admin reads behind the Knowledge base screens (N3): the Library tab, a
// document's view and the Required policies tab. Every read runs on the
// caller's own data client after library.functions.ts checked who is asking.

import { audienceWarning } from "./audience";
import {
  chainRootId,
  groupLibrary,
  isPastReview,
  LIBRARY_STATUS_LABEL,
  parseStatusLabel,
  STATE_RULES_NOTE,
  type LibraryStatus,
} from "./library";
import {
  activeMembers,
  currentRows,
  loadReviews,
  loadSlots,
  loadToggles,
  NOT_FOUND,
  ROW_COLUMNS,
  signedFileUrl,
  type Db,
} from "./library-data.server";
import { isReviewable, reviewCell, reviewCounts } from "./reviews";
import { splitSections } from "./sections";
import { requiredSlotStatus, SLOT_STATUS_LABEL, slotCodeLabel, type SlotDef } from "./slots";
import { splitDocumentSections } from "./typed-sections";

type Row = Awaited<ReturnType<typeof currentRows>>[number];

function statusLabel(status: string): string {
  return LIBRARY_STATUS_LABEL[status as LibraryStatus] ?? status;
}

function slotOf(slots: readonly SlotDef[], id: string | null) {
  const slot = id ? slots.find((s) => s.id === id) : undefined;
  return slot ? { id: slot.id, code: slotCodeLabel(slot.code), label: slot.label } : null;
}

/** Library tab: the four groups. State rules come from PI and are read-only. */
export async function readLibrary(db: Db, orgId: string, today: string) {
  const [rows, members, slots, stateRules] = await Promise.all([
    currentRows(db, orgId),
    activeMembers(db, orgId),
    loadSlots(db),
    db
      .from("state_rule_documents")
      .select("id, title, version")
      .is("archived_at", null)
      .not("published_at", "is", null)
      .order("title"),
  ]);
  const reviewable = new Set(
    rows.filter((r) => r.library_status === "published" && isReviewable(r.library_group)),
  );
  const reviews = await loadReviews(
    db,
    [...reviewable].map((r) => r.id),
  );
  const memberIds = members.map((m) => m.userId);
  const documentRow = (r: Row) => ({
    id: r.id,
    kind: "document" as "document" | "state_rule",
    title: r.title,
    status: r.library_status,
    statusLabel: statusLabel(r.library_status),
    version: r.version,
    owner: r.owner_name ?? r.uploaded_by_name ?? null,
    reviewDue: r.review_due,
    pastReview: r.library_status === "published" && isPastReview(r.review_due, today),
    slot: slotOf(slots, r.required_slot),
    audienceAll: r.audience_all,
    reviewed: reviewable.has(r) ? reviewCounts(r, memberIds, reviews) : null,
    parseLabel: parseStatusLabel(r.parse_status),
    note: null as string | null,
  });
  const stateRow = (s: { id: string; title: string; version: number }) => ({
    id: s.id,
    kind: "state_rule" as "document" | "state_rule",
    title: s.title,
    status: "published",
    statusLabel: statusLabel("published"),
    version: s.version,
    owner: null,
    reviewDue: null,
    pastReview: false,
    slot: null,
    audienceAll: true,
    reviewed: null,
    parseLabel: parseStatusLabel("parsed"),
    note: STATE_RULES_NOTE as string | null,
  });
  return {
    groups: groupLibrary(rows).map((g) => ({
      group: g.group,
      label: g.label,
      documents:
        g.group === "state" ? (stateRules.data ?? []).map(stateRow) : g.documents.map(documentRow),
    })),
  };
}

/** Document view: the version, its versions, its sections, who it's for and their reviews. */
export async function readLibraryDocument(
  db: Db,
  orgId: string,
  documentId: string,
  today: string,
) {
  const { data: doc } = await db
    .from("nectar_documents")
    .select(`${ROW_COLUMNS}, raw_text, storage_path, storage_bucket, mime_type, archived_at`)
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .not("library_group", "is", null)
    .maybeSingle();
  if (!doc) throw new Error(NOT_FOUND);
  const root = chainRootId(doc);
  const [versions, members, slots, fileUrl] = await Promise.all([
    db
      .from("nectar_documents")
      .select(
        "id, version, library_status, created_at, superseded_at, archived_at, uploaded_by_name",
      )
      .eq("organization_id", orgId)
      .or(`id.eq.${root},parent_document_id.eq.${root}`)
      .order("version", { ascending: false }),
    activeMembers(db, orgId),
    loadSlots(db),
    signedFileUrl(db, doc.storage_path, doc.storage_bucket),
  ]);
  const reviews = isReviewable(doc.library_group) ? await loadReviews(db, [doc.id]) : [];
  const memberIds = members.map((m) => m.userId);
  const { raw_text: text, ...fields } = doc;
  return {
    document: {
      ...fields,
      statusLabel: statusLabel(doc.library_status),
      pastReview: doc.library_status === "published" && isPastReview(doc.review_due, today),
      parseLabel: parseStatusLabel(doc.parse_status),
      slot: slotOf(slots, doc.required_slot),
      reviewable: isReviewable(doc.library_group),
    },
    versions: versions.data ?? [],
    /** The version's text, for Edit draft and Publish new version. */
    text: text ?? "",
    sections: splitDocumentSections(text ?? "", doc.mime_type),
    people: members.map((m) => ({
      ...m,
      checked: doc.audience_all || doc.policy_assigned_users.includes(m.userId),
      review: reviewCell(doc, m.userId, reviews),
    })),
    reviewed: reviewCounts(doc, memberIds, reviews),
    audienceWarning: audienceWarning(doc),
    fileUrl,
  };
}

/** Required policies tab: one row per slot, "X of Y" and the two agency answers. */
export async function readRequiredSlots(db: Db, orgId: string, today: string) {
  const [slots, toggles, docs] = await Promise.all([
    loadSlots(db),
    loadToggles(db, orgId),
    db
      .from("nectar_documents")
      .select("id, title, required_slot, library_status, review_due, superseded_by")
      .eq("organization_id", orgId)
      .not("required_slot", "is", null)
      .not("library_group", "is", null),
  ]);
  const status = requiredSlotStatus(slots, docs.data ?? [], toggles, today);
  const rows = status.rows.map((r) => ({
    ...r,
    codeLabel: slotCodeLabel(r.code),
    statusLabel: SLOT_STATUS_LABEL[r.status],
  }));
  return { ...status, rows, toggles };
}

/** A state rule, read-only (Decision 6): its sections and its published versions. */
export async function readStateRule(db: Db, stateRuleId: string) {
  const { data: rule } = await db
    .from("state_rule_documents")
    .select("id, rule_key, title, version, effective_from, published_at, archived_at, raw_text")
    .eq("id", stateRuleId)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!rule) throw new Error(NOT_FOUND);
  const { data: versions } = await db
    .from("state_rule_documents")
    .select("id, version, effective_from, published_at, archived_at")
    .eq("rule_key", rule.rule_key)
    .not("published_at", "is", null)
    .order("version", { ascending: false });
  const { raw_text: text, ...fields } = rule;
  return {
    rule: { ...fields, note: STATE_RULES_NOTE },
    versions: versions ?? [],
    sections: splitSections(text ?? ""),
  };
}

/**
 * One state rule section Nectar cited, read-only (N6): a team member opens a
 * state rule source in their own Nectar screen. Only state rule sections,
 * which every member may read (Decision 7); never an agency's own section.
 */
export async function readStateRuleSection(db: Db, sectionId: string) {
  const { data: section } = await db
    .from("knowledge_sections")
    .select("id, heading, body, version, state_document_id")
    .eq("id", sectionId)
    .not("state_document_id", "is", null)
    .maybeSingle();
  if (!section?.state_document_id) throw new Error(NOT_FOUND);
  const { data: rule } = await db
    .from("state_rule_documents")
    .select("id, title, version, effective_from")
    .eq("id", section.state_document_id)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!rule) throw new Error(NOT_FOUND);
  return {
    rule: { ...rule, note: STATE_RULES_NOTE },
    section: { id: section.id, heading: section.heading, body: section.body },
  };
}

/** The question a new draft answers ("Add to library" from the Questions tab, N6). */
export async function readDraftQuestion(db: Db, orgId: string, questionId: string) {
  const { data } = await db
    .from("nectar_questions")
    .select("id, question, status")
    .eq("id", questionId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) throw new Error("Question not found.");
  return { id: data.id, question: data.question, status: data.status };
}
