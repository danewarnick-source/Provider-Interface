// Evidence item writes shared by the Evidence server functions and the Client
// file: build an item from a catalog key, skip / restore patches (never a
// delete), and applying requirement keys to people. Callers check access first.

import { requirementByKey } from "./catalog.ts";
import {
  applyDueDraft,
  cadenceFromDue,
  defaultDueDraft,
  dueDefaultForRequirement,
  type EvidenceDueDraft,
} from "./due.ts";
import {
  insertItem,
  loadAll,
  newId,
  nowIso,
  patchItem,
  requireTables,
  type AnySupabase,
} from "./store.server.ts";
import {
  EVIDENCE_UNCHECKED_REASON,
  type EvidenceHistoryEntry,
  type EvidenceItemRow,
  type EvidenceSubject,
  type EvidenceType,
} from "./types.ts";

const withHistory = (item: EvidenceItemRow, entry: EvidenceHistoryEntry) => [
  ...(Array.isArray(item.history) ? item.history : []),
  entry,
];

export function skipPatch(
  item: EvidenceItemRow,
  userId: string,
  reason: string,
): Partial<EvidenceItemRow> {
  const at = nowIso();
  return {
    opted_out_at: at,
    opted_out_by: userId,
    opt_out_reason: reason,
    history: withHistory(item, { action: "skipped", by: userId, at, reason }),
  };
}

export function restorePatch(item: EvidenceItemRow, userId: string): Partial<EvidenceItemRow> {
  return {
    opted_out_at: null,
    opted_out_by: null,
    opt_out_reason: null,
    history: withHistory(item, { action: "restored", by: userId, at: nowIso() }),
  };
}

export function buildItemFromKey(args: {
  organizationId: string;
  subjectType: EvidenceSubject;
  subjectId: string;
  requirementKey: string;
  suggested: boolean;
  custom?: {
    title?: string;
    evidenceType?: EvidenceType;
    attestationText?: string | null;
    cadence?: EvidenceItemRow["cadence"];
    sowCite?: string | null;
    due?: EvidenceDueDraft;
    hireDate?: string | null;
    documentDate?: string | null;
    addedByHand?: boolean;
    description?: string | null;
  };
}): EvidenceItemRow {
  const def = requirementByKey(args.requirementKey);
  const now = nowIso();
  const due =
    args.custom?.due ??
    defaultDueDraft(
      args.subjectType,
      def?.dueDefault ??
        dueDefaultForRequirement({
          key: args.requirementKey,
          subject: args.subjectType,
          cadence: args.custom?.cadence ?? def?.cadence,
        }),
    );
  const computed = applyDueDraft({
    draft: due,
    hireDate: args.custom?.hireDate ?? null,
    documentDate: args.custom?.documentDate ?? null,
    hasFile: false,
  });
  return {
    id: newId(),
    organization_id: args.organizationId,
    subject_type: args.subjectType,
    subject_id: args.subjectId,
    requirement_key: args.requirementKey,
    title: args.custom?.title?.trim() || def?.title || args.requirementKey,
    evidence_type: args.custom?.evidenceType ?? def?.evidenceType ?? "upload",
    attestation_text: args.custom?.attestationText ?? def?.attestationText ?? null,
    cadence: args.custom?.cadence ?? cadenceFromDue(computed.renew_years),
    sow_cite: args.custom?.sowCite ?? def?.sowCite ?? null,
    suggested: args.suggested,
    sent_to_staff: false,
    visible_to_staff_id: null,
    send_message: null,
    dual_link_key: def?.dualLink ?? null,
    dual_link_peer_id: null,
    expires_on: computed.expires_on,
    first_due_rule: computed.first_due_rule,
    first_due_on: computed.first_due_on,
    document_date: computed.document_date,
    next_due_on: computed.next_due_on,
    renew_years: computed.renew_years,
    added_by_hand: args.custom?.addedByHand ?? false,
    description: args.custom?.description?.trim() || null,
    created_at: now,
    updated_at: now,
  };
}

export type ApplyRequirementsInput = {
  organizationId: string;
  subjectType: EvidenceSubject;
  subjectIds: string[];
  requirementKeys: string[];
  suggestedKeys?: string[];
  optedOutKeys?: string[];
  typeOverrides?: Record<string, EvidenceType>;
  dueOverrides?: Record<string, EvidenceDueDraft>;
  dualLinkClientId?: string | null;
  dualLinkStaffId?: string | null;
  /** Items added one at a time (not from a pack). */
  addedByHand?: boolean;
};

/** Add requirement keys to people; bring skipped ones back; save unchecked SOW rows as skipped. */
export async function applyRequirementKeys(
  sb: AnySupabase,
  userId: string,
  data: ApplyRequirementsInput,
  hireDateOf: (subjectId: string) => string | null = () => null,
): Promise<{ count: number; skipped: number }> {
  const { store, viaTables } = await loadAll(sb, data.organizationId);
  requireTables(viaTables);
  const suggested = new Set(data.suggestedKeys ?? []);
  const checked = new Set(data.requirementKeys);
  let count = 0;
  const created: EvidenceItemRow[] = [];

  for (const subjectId of data.subjectIds) {
    for (const key of data.requirementKeys) {
      const exists = store.items.find(
        (i) =>
          i.subject_type === data.subjectType &&
          i.subject_id === subjectId &&
          i.requirement_key === key,
      );
      if (exists) {
        // Checked again in a later pack review: bring a skipped item back.
        if (exists.opted_out_at) {
          await patchItem(
            sb,
            viaTables,
            data.organizationId,
            exists.id,
            restorePatch(exists, userId),
          );
        }
        continue;
      }
      const overrideType = data.typeOverrides?.[key];
      const def = requirementByKey(key);
      const evidenceType = overrideType ?? def?.evidenceType ?? "upload";
      const hireDate = hireDateOf(subjectId);
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: suggested.has(key),
        custom: {
          evidenceType,
          attestationText:
            evidenceType === "attestation"
              ? def?.attestationText || `I attest that ${def?.title ?? key} is complete.`
              : null,
          due: data.dueOverrides?.[key],
          hireDate,
          addedByHand: data.addedByHand,
        },
      });
      await insertItem(sb, viaTables, data.organizationId, row);
      created.push(row);
      count += 1;
    }
  }

  const hhsStaff = created.find((r) => r.requirement_key === "host_home_cert");
  const hhsClient = created.find((r) => r.requirement_key === "host_home_cert_client");
  if (hhsStaff && data.dualLinkClientId) {
    let peer = store.items.find(
      (i) =>
        i.subject_type === "client" &&
        i.subject_id === data.dualLinkClientId &&
        i.requirement_key === "host_home_cert_client",
    );
    if (!peer) {
      peer = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: "client",
        subjectId: data.dualLinkClientId,
        requirementKey: "host_home_cert_client",
        suggested: true,
      });
      await insertItem(sb, viaTables, data.organizationId, peer);
      count += 1;
    }
    await patchItem(sb, viaTables, data.organizationId, hhsStaff.id, {
      dual_link_peer_id: peer.id,
      dual_link_key: "host_home_cert",
    });
    await patchItem(sb, viaTables, data.organizationId, peer.id, {
      dual_link_peer_id: hhsStaff.id,
      dual_link_key: "host_home_cert",
    });
  } else if (hhsClient && data.dualLinkStaffId) {
    let peer = store.items.find(
      (i) =>
        i.subject_type === "staff" &&
        i.subject_id === data.dualLinkStaffId &&
        i.requirement_key === "host_home_cert",
    );
    if (!peer) {
      peer = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: "staff",
        subjectId: data.dualLinkStaffId,
        requirementKey: "host_home_cert",
        suggested: true,
      });
      await insertItem(sb, viaTables, data.organizationId, peer);
      count += 1;
    }
    await patchItem(sb, viaTables, data.organizationId, hhsClient.id, {
      dual_link_peer_id: peer.id,
      dual_link_key: "host_home_cert",
    });
    await patchItem(sb, viaTables, data.organizationId, peer.id, {
      dual_link_peer_id: hhsClient.id,
      dual_link_key: "host_home_cert",
    });
  }

  // Unchecked SOW rows: record the skip (who / when / why) instead of dropping it.
  let skipped = 0;
  const optedOut = [...new Set(data.optedOutKeys ?? [])].filter((k) => !checked.has(k));
  for (const subjectId of data.subjectIds) {
    for (const key of optedOut) {
      const exists = store.items.find(
        (i) =>
          i.subject_type === data.subjectType &&
          i.subject_id === subjectId &&
          i.requirement_key === key,
      );
      if (exists) {
        if (exists.opted_out_at) continue;
        await patchItem(
          sb,
          viaTables,
          data.organizationId,
          exists.id,
          skipPatch(exists, userId, EVIDENCE_UNCHECKED_REASON),
        );
        skipped += 1;
        continue;
      }
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: true,
        custom: {
          due: data.dueOverrides?.[key],
          hireDate: hireDateOf(subjectId),
        },
      });
      Object.assign(row, skipPatch(row, userId, EVIDENCE_UNCHECKED_REASON));
      await insertItem(sb, viaTables, data.organizationId, row);
      skipped += 1;
    }
  }
  return { count, skipped };
}
