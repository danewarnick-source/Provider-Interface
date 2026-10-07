// Client file data, read from Evidence: the client's items and files, its
// pack list (evidence_client_packs), the packs the agency has applied, and the
// codes behind them. Applying a plan writes through the shared Evidence store
// (evidence/items.server.ts): add keys, restore, skip with a reason. Never
// deletes anything. Callers check access first.

import { applyRequirementKeys, restorePatch, skipPatch } from "@/lib/evidence/items.server";
import {
  FILE_SELECT,
  ITEM_SELECT_WITH_DUE,
  normalizeItem,
  nowIso,
  patchItem,
  type AnySupabase,
} from "@/lib/evidence/store.server";
import type { EvidenceFileRow, EvidenceItemRow } from "@/lib/evidence/types";
import { loadActiveCodes } from "./codes";
import { todayYmd } from "./dates";
import { loadOrgClientFileIndex } from "./file-index";
import {
  PACK_REMOVED_BY_HAND,
  activeTriggers,
  clientPack,
  isCorePack,
  planClientPacks,
  type ClientPackRow,
  type PackPlan,
} from "./file-packs";
import { buildClientFile, type ClientFileGroup, type ElsewhereFacts } from "./file-rows";

async function rowsOf<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Save packs on clients (from the Evidence pack review or "Add a pack"). */
export async function recordClientPacks(
  sb: AnySupabase,
  userId: string,
  organizationId: string,
  clientIds: readonly string[],
  packKeys: readonly string[],
): Promise<void> {
  const codes = await loadActiveCodes(sb, clientIds);
  const rows = clientIds.flatMap((clientId) =>
    packKeys.flatMap((packKey) => {
      const pack = clientPack(packKey);
      if (!pack) return [];
      const fromCode =
        isCorePack(pack) || activeTriggers(pack, codes.get(clientId) ?? []).length > 0;
      return [
        {
          organization_id: organizationId,
          client_id: clientId,
          pack_key: packKey,
          origin: fromCode ? "code" : "hand",
          added_by: userId,
          added_at: nowIso(),
          removed_at: null,
          removed_by: null,
          removed_reason: null,
          updated_at: nowIso(),
        },
      ];
    }),
  );
  if (!rows.length) return;
  const { error } = await sb
    .from("evidence_client_packs")
    .upsert(rows, { onConflict: "organization_id,client_id,pack_key" });
  if (error) throw new Error(error.message);
}

/** Mark one pack removed on a client (its rows are retired by the next plan). */
export async function markClientPackRemoved(
  sb: AnySupabase,
  userId: string,
  organizationId: string,
  clientId: string,
  packKey: string,
  reason: string = PACK_REMOVED_BY_HAND,
): Promise<void> {
  const { error } = await sb
    .from("evidence_client_packs")
    .update({
      removed_at: nowIso(),
      removed_by: userId,
      removed_reason: reason,
      updated_at: nowIso(),
    })
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("pack_key", packKey);
  if (error) throw new Error(error.message);
}

export type ClientFileView = {
  groups: ClientFileGroup[];
  packs: ClientPackRow[];
  activePackKeys: string[];
  activeCodes: string[];
  /** The agency has applied at least one client pack. */
  agencyHasPacks: boolean;
  /** The saved file is behind the client's codes (an admin's visit catches it up). */
  pending: boolean;
  plan: PackPlan;
  items: EvidenceItemRow[];
};

export async function loadClientFileView(
  sb: AnySupabase,
  organizationId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientFileView> {
  const today = todayYmd(now);
  const [items, packs, agencyRows, codes, billing, index] = await Promise.all([
    rowsOf<EvidenceItemRow>(
      sb
        .from("evidence_items")
        .select(ITEM_SELECT_WITH_DUE)
        .eq("organization_id", organizationId)
        .eq("subject_type", "client")
        .eq("subject_id", clientId),
    ).then((r) => r.map(normalizeItem)),
    rowsOf<ClientPackRow>(
      sb
        .from("evidence_client_packs")
        .select("pack_key, origin, removed_at, removed_reason")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId),
    ),
    rowsOf<{ pack_key: string }>(
      sb.from("evidence_client_packs").select("pack_key").eq("organization_id", organizationId),
    ),
    loadActiveCodes(sb, [clientId]),
    // Ended codes and their dates; team members can't read billing rows, so best effort.
    rowsOf<{ service_code: string; service_end_date: string | null }>(
      sb
        .from("client_billing_codes")
        .select("service_code, service_end_date")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId),
    ).catch(() => []),
    loadOrgClientFileIndex(sb, organizationId, [clientId]),
  ]);
  const files = items.length
    ? await rowsOf<EvidenceFileRow>(
        sb
          .from("evidence_files")
          .select(FILE_SELECT)
          .in(
            "item_id",
            items.map((i) => i.id),
          ),
      )
    : [];
  const activeCodes = codes.get(clientId) ?? [];
  const endedCodes = endedCodesOf(billing, activeCodes);
  const facts = index.factsByClient.get(clientId);
  const ownGuardian = facts?.isOwnGuardian ?? false;
  const agencyPackKeys = new Set(agencyRows.map((r) => r.pack_key));
  const plan = planClientPacks({
    activeCodes,
    endedCodes,
    clientPacks: packs,
    agencyPackKeys,
    items,
    ownGuardian,
  });
  const groups = buildClientFile({
    items,
    files,
    plan,
    clientPacks: packs,
    activeCodes,
    ownGuardian,
    elsewhere: elsewhereFacts(index.cardsByClient.get(clientId) ?? [], facts?.grievanceOk ?? false),
    today,
  });
  const pending =
    plan.addPacks.length +
      plan.endPacks.length +
      plan.addKeys.length +
      plan.restoreItemIds.length +
      plan.retireItems.length >
    0;
  return {
    groups,
    packs,
    activePackKeys: plan.activePackKeys,
    activeCodes,
    agencyHasPacks: agencyPackKeys.size > 0,
    pending,
    plan,
    items,
  };
}

/** Codes with no open authorization row, each with its last end date. */
function endedCodesOf(
  rows: readonly { service_code: string; service_end_date: string | null }[],
  activeCodes: readonly string[],
): { code: string; endedOn: string | null }[] {
  const last = new Map<string, string>();
  for (const r of rows) {
    const code = r.service_code.trim().toUpperCase();
    const end = r.service_end_date?.slice(0, 10);
    if (!code || !end || activeCodes.includes(code)) continue;
    if (!last.has(code) || last.get(code)! < end) last.set(code, end);
  }
  return [...last].map(([code, endedOn]) => ({ code, endedOn }));
}

const ELSEWHERE_CARD: Record<string, string[]> = {
  photograph: ["client_photo"],
  pcsp: ["client_pcsp"],
  support_strategies: ["support_strategies"],
  belongings: ["belongings_inventory_hhs", "belongings_inventory_rhs", "belongings_inventory_pps"],
};

/** Status of records the profile keeps elsewhere (photo, plan, strategies, belongings, signed grievance). */
function elsewhereFacts(
  cards: readonly { key: string; status: string; dueAt: string | null }[],
  grievanceOk: boolean,
): ElsewhereFacts {
  const out: ElsewhereFacts = {};
  for (const card of cards) {
    for (const key of ELSEWHERE_CARD[card.key] ?? []) {
      out[key] = { onFile: card.status !== "missing", dueOn: card.dueAt?.slice(0, 10) ?? null };
    }
  }
  if (grievanceOk) out.grievance_receipt = { onFile: true, dueOn: null };
  return out;
}

/** Save a plan: pack rows, new items, restored and retired items. */
export async function applyClientPackPlan(
  sb: AnySupabase,
  userId: string,
  organizationId: string,
  clientId: string,
  view: Pick<ClientFileView, "plan" | "items">,
): Promise<void> {
  const { plan, items } = view;
  if (plan.addPacks.length) {
    await recordClientPacks(sb, userId, organizationId, [clientId], plan.addPacks);
  }
  for (const end of plan.endPacks) {
    await markClientPackRemoved(sb, userId, organizationId, clientId, end.packKey, end.reason);
  }
  if (plan.addKeys.length) {
    await applyRequirementKeys(sb, userId, {
      organizationId,
      subjectType: "client",
      subjectIds: [clientId],
      requirementKeys: plan.addKeys,
      suggestedKeys: plan.addKeys,
    });
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const id of plan.restoreItemIds) {
    const item = byId.get(id);
    if (item) await patchItem(sb, true, organizationId, id, restorePatch(item, userId));
  }
  for (const { id, reason } of plan.retireItems) {
    const item = byId.get(id);
    if (item) await patchItem(sb, true, organizationId, id, skipPatch(item, userId, reason));
  }
}
