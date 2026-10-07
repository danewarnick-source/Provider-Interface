/**
 * Evidence Phase 1 persistence.
 * Writes only evidence_items and evidence_files (plus the client's pack list,
 * evidence_client_packs, when a client pack is applied).
 * Items are never deleted from here: "remove" is a Skip (opted_out_* + history),
 * and Restore clears it. Team members' own uploads wait for admin review.
 * Does not read or write organizations.feature_config.
 * Does not write requirement_defs or company_obligations.
 * Reads and writes go through evidence/store.server.ts and items.server.ts.
 */
import { loadActiveCodes } from "@/lib/clients/codes";
import { recordClientPacks } from "@/lib/clients/file-packs.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { hasCategory } from "@/lib/access/can";
import { requireCategory } from "@/lib/access/require";
import { hostHomeDualLinkPeerKey } from "./evidence/catalog.ts";
import {
  companyEvidencePerson,
  loadEvidenceClientPeople,
  mapEmployeeRowsToPeople,
  type EvidenceEmployeeRow,
} from "./evidence/people.ts";
import { applyDueDraft, cadenceFromDue, parseIsoDate } from "./evidence/due.ts";
import {
  applyRequirementKeys,
  buildItemFromKey,
  restorePatch,
  skipPatch,
} from "./evidence/items.server.ts";
import {
  emptyStore,
  FILE_SELECT,
  insertFileRow,
  insertItem,
  loadAll,
  mapEvidenceDbError,
  newId,
  nowIso,
  patchItem,
  requireTables,
  sendMessageColumnMissing,
  type AnySupabase,
  type StoreV1,
} from "./evidence/store.server.ts";
import { saveUploadOnItem } from "./evidence/record-upload.server.ts";
import { latestFileForItem } from "./evidence/status.ts";
import {
  EVIDENCE_PUSH_BODY,
  EVIDENCE_PUSH_LINK,
  EVIDENCE_PUSH_TITLE,
  EVIDENCE_SEND_MESSAGE_UNAVAILABLE,
  FIRST_DUE_RULES,
  type EvidenceFileRow,
  type EvidenceItemRow,
  type EvidencePerson,
  type EvidenceSubject,
} from "./evidence/types.ts";

const SubjectEnum = z.enum(["staff", "client", "company"]);
const TypeEnum = z.enum(["upload", "attestation"]);

const todayStamp = () => new Date().toISOString().slice(0, 10);

const FirstDueEnum = z.enum(FIRST_DUE_RULES);
const DueDraftSchema = z.object({
  firstDueRule: FirstDueEnum,
  firstDueOn: z.string().nullable(),
  renewYears: z.union([z.literal(1), z.literal(2), z.null()]),
  nextDueMode: z.enum(["years", "set_date", "none"]),
  nextDueOn: z.string().nullable(),
});

async function listStaffPeople(
  sb: AnySupabase,
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  try {
    const { data: members, error } = await sb
      .from("organization_members")
      .select("user_id, role:access_level, job_title, active")
      .eq("organization_id", organizationId);
    if (error) return { people: [], error: error.message };
    const rows = (members ?? []) as Array<{
      user_id: string;
      role: string | null;
      job_title: string | null;
      active: boolean | null;
    }>;
    const ids = rows.map((m) => m.user_id).filter((id) => typeof id === "string");
    if (ids.length === 0) return { people: [], error: null };
    const withHire = await sb
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, account_status, is_active, hire_date, start_date",
      )
      .in("id", ids);
    const full = withHire.error
      ? await sb
          .from("profiles")
          .select("id, full_name, first_name, last_name, account_status, is_active")
          .in("id", ids)
      : withHire;
    const slim = full.error
      ? await sb.from("profiles").select("id, full_name, account_status, is_active").in("id", ids)
      : full;
    if (slim.error) {
      return {
        people: [],
        error: slim.error.message || full.error?.message || "Could not load team members.",
      };
    }
    const profMap = new Map(
      (
        (slim.data ?? []) as Array<{
          id: string;
          full_name: string | null;
          first_name?: string | null;
          last_name?: string | null;
          account_status: string | null;
          is_active: boolean | null;
          hire_date?: string | null;
          start_date?: string | null;
        }>
      ).map((p) => [p.id, p]),
    );
    const joined: EvidenceEmployeeRow[] = rows.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      job_title: m.job_title,
      active: m.active !== false,
      profile: profMap.get(m.user_id) ?? null,
    }));
    return { people: mapEmployeeRowsToPeople(joined), error: null };
  } catch (e) {
    return {
      people: [],
      error: e instanceof Error ? e.message : "Could not load team members.",
    };
  }
}

async function listClientPeople(
  sb: AnySupabase,
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  return loadEvidenceClientPeople(
    (columns) =>
      sb
        .from("clients")
        .select(columns)
        .eq("organization_id", organizationId)
        .order("last_name", { ascending: true }),
    (ids) => loadActiveCodes(sb, ids),
  );
}

function companyNameFromOrgRow(
  org: {
    name?: string | null;
    legal_name?: string | null;
    dba_name?: string | null;
  } | null,
): string {
  const dba = (org?.dba_name ?? "").trim();
  const legal = (org?.legal_name ?? "").trim();
  const name = (org?.name ?? "").trim();
  return dba || legal || name || "Company";
}

async function notifyStaffNoPhi(
  sb: AnySupabase,
  organizationId: string,
  staffId: string,
): Promise<void> {
  try {
    await sb.from("notifications").insert({
      organization_id: organizationId,
      recipient_user_id: staffId,
      type: "evidence_assigned",
      urgency: "normal",
      title: EVIDENCE_PUSH_TITLE,
      body: EVIDENCE_PUSH_BODY,
      link_to: EVIDENCE_PUSH_LINK,
      related_type: "evidence_item",
    });
  } catch {
    /* never block assign on notification */
  }
}

export type EvidenceBoard = {
  viaTables: boolean;
  subject: EvidenceSubject;
  people: EvidencePerson[];
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
  staffPicker: EvidencePerson[];
  peopleError: string | null;
};

function boardFromStore(args: {
  viaTables: boolean;
  subject: EvidenceSubject;
  people: EvidencePerson[];
  store: StoreV1;
  staffPicker: EvidencePerson[];
  peopleError?: string | null;
}): EvidenceBoard {
  const items = args.store.items.filter((i) => i.subject_type === args.subject);
  return {
    viaTables: args.viaTables,
    subject: args.subject,
    people: args.people,
    items,
    files: args.store.files.filter((f) => items.some((i) => i.id === f.item_id)),
    staffPicker: args.staffPicker,
    peopleError: args.peopleError ?? null,
  };
}

export const loadEvidenceBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subject: SubjectEnum,
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<EvidenceBoard> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return boardFromStore({
        viaTables: false,
        subject: data.subject,
        people: [],
        store: emptyStore(),
        staffPicker: [],
      });
    }
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const staffListed = await listStaffPeople(sb, data.organizationId);
    const staff = staffListed.people;
    let people: EvidencePerson[] = staff;
    let peopleError: string | null = data.subject === "staff" ? staffListed.error : null;
    if (data.subject === "client") {
      const listed = await listClientPeople(sb, data.organizationId);
      people = listed.people;
      peopleError = listed.error;
    }
    if (data.subject === "company") {
      try {
        const { data: org } = await sb
          .from("organizations")
          .select("name, legal_name, dba_name")
          .eq("id", data.organizationId)
          .maybeSingle();
        people = [companyEvidencePerson(data.organizationId, companyNameFromOrgRow(org ?? null))];
        peopleError = null;
      } catch {
        people = [companyEvidencePerson(data.organizationId, "Company")];
        peopleError = null;
      }
    }
    return boardFromStore({
      viaTables,
      subject: data.subject,
      people,
      store,
      staffPicker: staff,
      peopleError,
    });
  });

export const applyEvidenceRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        requirementKeys: z.array(z.string().min(1)).min(1),
        suggestedKeys: z.array(z.string()).optional(),
        packKeys: z.array(z.string()).optional(),
        /** Suggested SOW rows the admin unchecked. Saved as skipped items so the decision is on record. */
        optedOutKeys: z.array(z.string()).optional(),
        typeOverrides: z.record(z.string(), TypeEnum).optional(),
        dueOverrides: z.record(z.string(), DueDraftSchema).optional(),
        dualLinkClientId: z.string().uuid().nullable().optional(),
        dualLinkStaffId: z.string().uuid().nullable().optional(),
        /** Items added one at a time (Client file "Add one item"), not from a pack. */
        addedByHand: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, count: 0 };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const staff =
      data.subjectType === "staff" ? (await listStaffPeople(sb, data.organizationId)).people : [];
    const { count, skipped } = await applyRequirementKeys(sb, userId, data, (id) =>
      data.subjectType === "staff" ? (staff.find((p) => p.id === id)?.hire_date ?? null) : null,
    );
    if (data.subjectType === "client" && data.packKeys?.length) {
      await recordClientPacks(sb, userId, data.organizationId, data.subjectIds, data.packKeys);
    }
    return { ok: true as const, count, skipped };
  });

export const upsertEvidenceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        requirementKey: z.string().min(1).optional(),
        title: z.string().min(1),
        evidenceType: TypeEnum,
        attestationText: z.string().nullable().optional(),
        sowCite: z.string().nullable().optional(),
        expiresOn: z.string().nullable().optional(),
        due: DueDraftSchema.optional(),
        hireDate: z.string().nullable().optional(),
        /** A short plain-words explanation shown with the item. */
        description: z.string().trim().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const key = data.requirementKey?.trim() || `custom:${newId()}`;
    if (/^(w-?9|i-?9)$/i.test(key) || /^(w-?9|i-?9)$/i.test(data.title.trim())) {
      // Optional custom only — still allowed, but never a catalog built-in.
    }
    for (const subjectId of data.subjectIds) {
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: false,
        custom: {
          title: data.title,
          evidenceType: data.evidenceType,
          attestationText: data.attestationText ?? null,
          sowCite: data.sowCite ?? null,
          due: data.due,
          hireDate: data.hireDate ?? null,
          addedByHand: true,
          description: data.description ?? null,
        },
      });
      if (data.expiresOn) {
        row.expires_on = data.expiresOn;
        row.next_due_on = data.expiresOn;
        row.first_due_rule = "set_date";
        row.first_due_on = data.expiresOn;
      }
      await insertItem(sb, viaTables, data.organizationId, row);
    }
    return { ok: true as const, requirementKey: key };
  });

/**
 * Skip an evidence item. Never deletes the item or its files: sets
 * opted_out_at / opted_out_by / opt_out_reason and appends to history.
 */
export const removeEvidenceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        reason: z.string().trim().min(1, "Give a reason for skipping.").max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    if (found.opted_out_at) return { ok: true as const };
    const saved = await patchItem(
      sb,
      viaTables,
      data.organizationId,
      data.itemId,
      skipPatch(found, userId, data.reason),
    );
    if (!saved) throw new Error("You don't have access to skip this item.");
    return { ok: true as const };
  });

/** Undo a Skip: clears the opt-out fields and appends {action:"restored"} to history. */
export const restoreEvidenceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    if (!found.opted_out_at) return { ok: true as const };
    const saved = await patchItem(
      sb,
      viaTables,
      data.organizationId,
      data.itemId,
      restorePatch(found, userId),
    );
    if (!saved) throw new Error("You don't have access to restore this item.");
    return { ok: true as const };
  });

export const sendEvidenceToStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemIds: z.array(z.string().uuid()).min(1),
        staffId: z.string().uuid().optional(),
        message: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, messageStored: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { store, viaTables, hasSendMessage } = await loadAll(sb, data.organizationId);
    const note = (data.message ?? "").trim();
    const wantMessage = note.length > 0;
    let messageStored = false;
    const notified = new Set<string>();
    for (const itemId of data.itemIds) {
      const found = store.items.find((i) => i.id === itemId);
      if (!found) continue;
      const staffId =
        data.staffId ??
        (found.subject_type === "staff" ? found.subject_id : found.visible_to_staff_id);
      if (!staffId) continue;
      const patch: Partial<EvidenceItemRow> = {
        sent_to_staff: true,
        visible_to_staff_id: staffId,
      };
      if (wantMessage && hasSendMessage) {
        patch.send_message = note;
        messageStored = true;
      }
      try {
        await patchItem(sb, viaTables, data.organizationId, itemId, patch);
      } catch (err) {
        const text = err instanceof Error ? err.message : "";
        if (wantMessage && sendMessageColumnMissing(text)) {
          await patchItem(sb, viaTables, data.organizationId, itemId, {
            sent_to_staff: true,
            visible_to_staff_id: staffId,
          });
          messageStored = false;
        } else {
          throw err;
        }
      }
      if (!notified.has(staffId)) {
        await notifyStaffNoPhi(sb, data.organizationId, staffId);
        notified.add(staffId);
      }
    }
    return {
      ok: true as const,
      messageStored,
      messageSkipped: wantMessage && !messageStored,
      skipReason: wantMessage && !messageStored ? EVIDENCE_SEND_MESSAGE_UNAVAILABLE : null,
    };
  });

export const recordEvidenceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        storagePath: z.string().min(1),
        filename: z.string().min(1),
        expiresOn: z.string().nullable().optional(),
        documentDate: z.string().nullable().optional(),
        nextDueOn: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    const access = await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    // The team member's own upload waits for an admin. An admin filing it for
    // them is accepted on the spot (and recorded as their review).
    const ownUpload =
      (found.subject_type === "staff" && found.subject_id === userId) ||
      found.visible_to_staff_id === userId;
    const accepts = !ownUpload && hasCategory(access.categories, "staff_compliance", "edit");
    await saveUploadOnItem(sb, viaTables, {
      organizationId: data.organizationId,
      userId,
      item: found,
      storagePath: data.storagePath,
      filename: data.filename,
      accepted: accepts,
      documentDate: data.documentDate,
      nextDueOn: parseIsoDate(data.nextDueOn) ?? parseIsoDate(data.expiresOn),
      notes: data.notes,
    });
    return { ok: true as const };
  });

export const recordEvidenceAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        attestationText: z.string().min(1),
        documentDate: z.string().nullable().optional(),
        nextDueOn: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const row: EvidenceFileRow = {
      id: newId(),
      organization_id: data.organizationId,
      item_id: data.itemId,
      storage_path: null,
      filename: null,
      attested_at: nowIso(),
      attested_by: userId,
      attestation_text_snapshot: data.attestationText,
      uploaded_by: userId,
      uploaded_at: nowIso(),
      notes: null,
    };
    await insertFileRow(sb, viaTables, data.organizationId, row);
    const documentDate = parseIsoDate(data.documentDate) ?? found.document_date ?? todayStamp();
    const nextDue =
      parseIsoDate(data.nextDueOn) ??
      applyDueDraft({
        draft: {
          firstDueRule: found.first_due_rule ?? "set_date",
          firstDueOn: found.first_due_on,
          renewYears: found.renew_years,
          nextDueMode: found.renew_years ? "years" : found.next_due_on ? "set_date" : "none",
          nextDueOn: found.next_due_on,
        },
        hireDate: null,
        documentDate,
        hasFile: true,
      }).next_due_on;
    const duePatch = {
      document_date: documentDate,
      next_due_on: nextDue,
      expires_on: nextDue,
    };
    await patchItem(sb, viaTables, data.organizationId, data.itemId, duePatch);
    if (found.dual_link_peer_id) {
      await insertFileRow(sb, viaTables, data.organizationId, {
        ...row,
        id: newId(),
        item_id: found.dual_link_peer_id,
      });
      await patchItem(sb, viaTables, data.organizationId, found.dual_link_peer_id, duePatch);
    }
    return { ok: true as const };
  });

export const listMySentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId)
      return { items: [] as EvidenceItemRow[], files: [] as EvidenceFileRow[] };
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const sb = supabase as AnySupabase;
    const { store } = await loadAll(sb, data.organizationId);
    const items = store.items.filter(
      (i) => i.sent_to_staff && i.visible_to_staff_id === userId && !i.opted_out_at,
    );
    const files = store.files.filter((f) => items.some((i) => i.id === f.item_id));
    return { items, files };
  });

export const linkHostHomeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        peerSubjectId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const peerKey = hostHomeDualLinkPeerKey(found.requirement_key);
    if (!peerKey) throw new Error("This row is not a Host Home Certification dual-link.");
    const peerSubject: EvidenceSubject = found.subject_type === "staff" ? "client" : "staff";
    let peer = store.items.find(
      (i) =>
        i.subject_type === peerSubject &&
        i.subject_id === data.peerSubjectId &&
        i.requirement_key === peerKey,
    );
    if (!peer) {
      peer = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: peerSubject,
        subjectId: data.peerSubjectId,
        requirementKey: peerKey,
        suggested: true,
      });
      await insertItem(sb, viaTables, data.organizationId, peer);
    }
    await patchItem(sb, viaTables, data.organizationId, found.id, {
      dual_link_peer_id: peer.id,
      dual_link_key: "host_home_cert",
    });
    await patchItem(sb, viaTables, data.organizationId, peer.id, {
      dual_link_peer_id: found.id,
      dual_link_key: "host_home_cert",
    });
    return { ok: true as const, peerId: peer.id };
  });

export const createEvidenceChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        title: z.string().min(1).max(160),
        description: z.string().max(2000).optional(),
        questions: z.array(z.string().min(1).max(400)).min(1).max(40),
        due: DueDraftSchema.optional(),
        hireDate: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, requirementKey: null as string | null };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const key = `form:${newId()}`;
    const prompts = data.questions.map((q) => q.trim()).filter(Boolean);
    const attestationText = prompts.map((q, i) => `${i + 1}. ${q}`).join("\n");
    for (const subjectId of data.subjectIds) {
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: false,
        custom: {
          title: data.title.trim(),
          evidenceType: "attestation",
          attestationText,
          sowCite: "Agency form",
          due: data.due,
          hireDate: data.hireDate ?? null,
        },
      });
      await insertItem(sb, viaTables, data.organizationId, row);
    }
    try {
      const fields = prompts.map((label, i) => ({
        id: `q${i + 1}`,
        type: "yes_no",
        label,
        required: true,
      }));
      const assignedUsers = data.subjectType === "staff" ? data.subjectIds : [];
      const assignedClients = data.subjectType === "client" ? data.subjectIds : [];
      await sb.from("forms").insert({
        organization_id: data.organizationId,
        name: data.title.trim(),
        description: data.description?.trim() || null,
        category: "evidence",
        fields,
        frequency: "as_needed",
        schedule: {},
        assigned_groups: [],
        assigned_users: assignedUsers,
        all_clients: data.subjectType !== "client",
        assigned_clients: assignedClients,
        settings: { source: "evidence", requirement_key: key },
        created_by: userId,
      });
    } catch {
      /* Forms table is optional — evidence row is the source of truth. */
    }
    return { ok: true as const, requirementKey: key };
  });

export const updateEvidenceDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        due: DueDraftSchema,
        hireDate: z.string().nullable().optional(),
        documentDate: z.string().nullable().optional(),
        hasFile: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const computed = applyDueDraft({
      draft: data.due,
      hireDate: data.hireDate ?? null,
      documentDate: data.documentDate ?? found.document_date,
      hasFile: data.hasFile ?? !!latestFileForItem(store.files, found.id),
    });
    await patchItem(sb, viaTables, data.organizationId, data.itemId, {
      first_due_rule: computed.first_due_rule,
      first_due_on: computed.first_due_on,
      document_date: computed.document_date,
      next_due_on: computed.next_due_on,
      renew_years: computed.renew_years,
      expires_on: computed.expires_on,
      cadence: cadenceFromDue(computed.renew_years),
    });
    return { ok: true as const };
  });

/**
 * Admin review of an uploaded file: accept it, or send it back with a note.
 * Needs Team member file & training (staff_compliance) Edit. A dual-linked copy
 * of the same upload is reviewed with it.
 */
export const reviewEvidenceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        fileId: z.string().uuid(),
        decision: z.enum(["accepted", "sent_back"]),
        note: z.string().trim().max(2000).nullable().optional(),
      })
      .refine((v) => v.decision !== "sent_back" || !!v.note?.trim(), {
        message: "Add a note so the team member knows what to fix.",
        path: ["note"],
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireCategory(supabase, userId, data.organizationId, "staff_compliance", "edit");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const file = store.files.find((f) => f.id === data.fileId);
    if (!file) throw new Error("Evidence file not found");
    const item = store.items.find((i) => i.id === file.item_id);
    const patch = {
      review_status: data.decision,
      reviewed_by: userId,
      reviewed_at: nowIso(),
      review_note: data.note?.trim() || null,
    };
    const { data: updated, error } = await sb
      .from("evidence_files")
      .update(patch)
      .eq("organization_id", data.organizationId)
      .eq("id", file.id)
      .select("id");
    if (error) throw new Error(mapEvidenceDbError(error.message));
    if (!updated || updated.length === 0) {
      throw new Error("You don't have access to review this file.");
    }
    if (item?.dual_link_peer_id && file.storage_path) {
      const peer = await sb
        .from("evidence_files")
        .update(patch)
        .eq("organization_id", data.organizationId)
        .eq("item_id", item.dual_link_peer_id)
        .eq("storage_path", file.storage_path)
        .eq("review_status", "pending");
      if (peer.error) throw new Error(mapEvidenceDbError(peer.error.message));
    }
    return { ok: true as const };
  });
