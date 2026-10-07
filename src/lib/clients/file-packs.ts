// Client file packs follow the client's service codes. Pure: given the
// client's codes, its pack list (evidence_client_packs), the packs the agency
// has applied at all, and its Evidence items, work out what to add, bring
// back and retire. Nothing is ever deleted: a retired item is skipped with a
// reason ("HHS ended Aug 31, 2026", "Pack removed") and keeps its files.

import { EVIDENCE_PACKS, defaultQuestionnaireAnswers } from "../evidence/catalog.ts";
import {
  SERVICE_CODE_FLAGS,
  type EvidencePackDef,
  type ServiceCodeFlag,
} from "../evidence/types.ts";
import { formatDate } from "./dates.ts";

export const CLIENT_PACKS: readonly EvidencePackDef[] = EVIDENCE_PACKS.filter(
  (p) => p.subject === "client",
);

/** Only people with these codes ever get housemate, room and board or lease rows. */
export const RESIDENTIAL_CODES = ["HHS", "PPS", "RHS"] as const;
export const RESIDENTIAL_ONLY_KEYS: ReadonlySet<string> = new Set([
  "housemate_discussion",
  "room_board_agreement",
  "room_board_agreement_pps",
  "lease_housing",
]);
export const GUARDIAN_KEY = "guardian_papers";

export const PACK_REMOVED_REASON = "Pack removed";
/** On the pack row itself when an admin removes it: codes never bring it back. */
export const PACK_REMOVED_BY_HAND = "Removed by hand";
export const OWN_GUARDIAN_REASON = "Client is their own guardian";
export const NO_SERVICE_REASON = "No active service needs it";
const CODE_ENDED = /^[A-Z0-9]{2,4} ended\b/;

/** "HHS ended Aug 31, 2026" (or "HHS ended" when the date isn't known). */
export function codeEndedReason(code: string, endedOn: string | null): string {
  return endedOn ? `${code} ended ${formatDate(endedOn)}` : `${code} ended`;
}

/** True for reasons PI wrote itself (code ended, pack removed…), which PI may undo. */
export function isAutoReason(reason: string | null | undefined): boolean {
  const r = (reason ?? "").trim();
  return (
    CODE_ENDED.test(r) ||
    r === PACK_REMOVED_REASON ||
    r === OWN_GUARDIAN_REASON ||
    r === NO_SERVICE_REASON
  );
}

export function clientPack(key: string): EvidencePackDef | null {
  return CLIENT_PACKS.find((p) => p.key === key) ?? null;
}

/** The pack every client gets, whatever their codes. */
export function isCorePack(pack: EvidencePackDef): boolean {
  return pack.when(defaultQuestionnaireAnswers("client"));
}

/** Codes that bring a pack ([] for the core pack). */
export function packTriggerCodes(pack: EvidencePackDef): ServiceCodeFlag[] {
  if (isCorePack(pack)) return [];
  const base = defaultQuestionnaireAnswers("client");
  return SERVICE_CODE_FLAGS.filter((code) => pack.when({ ...base, serviceCodes: [code] }));
}

/** Which of the client's active codes bring this pack. */
export function activeTriggers(pack: EvidencePackDef, activeCodes: readonly string[]): string[] {
  const codes = new Set(activeCodes.map((c) => c.toUpperCase()));
  return packTriggerCodes(pack).filter((c) => codes.has(c));
}

export function hasResidentialCode(activeCodes: readonly string[]): boolean {
  return activeCodes.some((c) =>
    (RESIDENTIAL_CODES as readonly string[]).includes(c.toUpperCase()),
  );
}

export type ClientPackRow = {
  pack_key: string;
  origin: "code" | "hand";
  removed_at: string | null;
  removed_reason: string | null;
};

export type PlanItem = {
  id: string;
  requirement_key: string;
  opted_out_at?: string | null;
  opt_out_reason?: string | null;
  added_by_hand?: boolean | null;
};

export type PackPlanInput = {
  activeCodes: readonly string[];
  /** Codes whose authorization ended, with the last end date. */
  endedCodes: readonly { code: string; endedOn: string | null }[];
  clientPacks: readonly ClientPackRow[];
  /** Packs the agency has applied to any client. */
  agencyPackKeys: ReadonlySet<string>;
  items: readonly PlanItem[];
  ownGuardian: boolean;
};

export type PackPlan = {
  /** New pack rows (or code packs brought back), origin 'code'. */
  addPacks: string[];
  /** Code packs whose codes all ended. */
  endPacks: { packKey: string; reason: string }[];
  activePackKeys: string[];
  requiredKeys: string[];
  /** Required keys with no item yet. */
  addKeys: string[];
  /** Items PI retired that are needed again. */
  restoreItemIds: string[];
  retireItems: { id: string; reason: string }[];
};

function endedReasonFor(pack: EvidencePackDef, input: PackPlanInput): string {
  const triggers = new Set<string>(packTriggerCodes(pack));
  const ended = input.endedCodes
    .filter((e) => triggers.has(e.code.toUpperCase()))
    .sort((a, b) => (b.endedOn ?? "").localeCompare(a.endedOn ?? ""))[0];
  return ended ? codeEndedReason(ended.code.toUpperCase(), ended.endedOn) : NO_SERVICE_REASON;
}

function residentialEndedReason(input: PackPlanInput): string {
  const ended = input.endedCodes
    .filter((e) => (RESIDENTIAL_CODES as readonly string[]).includes(e.code.toUpperCase()))
    .sort((a, b) => (b.endedOn ?? "").localeCompare(a.endedOn ?? ""))[0];
  return ended ? codeEndedReason(ended.code.toUpperCase(), ended.endedOn) : NO_SERVICE_REASON;
}

/** Keys a set of packs needs for this client, after the residential and guardian rules. */
export function requiredKeysFor(
  packKeys: readonly string[],
  activeCodes: readonly string[],
  ownGuardian: boolean,
): string[] {
  const residential = hasResidentialCode(activeCodes);
  const keys = new Set<string>();
  for (const key of packKeys) {
    for (const k of clientPack(key)?.requirementKeys ?? []) {
      if (!residential && RESIDENTIAL_ONLY_KEYS.has(k)) continue;
      if (ownGuardian && k === GUARDIAN_KEY) continue;
      keys.add(k);
    }
  }
  return [...keys];
}

export function planClientPacks(input: PackPlanInput): PackPlan {
  const rowByKey = new Map(input.clientPacks.map((r) => [r.pack_key, r]));
  const addPacks: string[] = [];
  const endPacks: PackPlan["endPacks"] = [];

  for (const pack of CLIENT_PACKS) {
    if (!input.agencyPackKeys.has(pack.key)) continue;
    const row = rowByKey.get(pack.key);
    const wanted = isCorePack(pack) || activeTriggers(pack, input.activeCodes).length > 0;
    if (!wanted) continue;
    if (!row || (row.removed_at && isAutoReason(row.removed_reason))) addPacks.push(pack.key);
  }
  for (const row of input.clientPacks) {
    const pack = clientPack(row.pack_key);
    if (!pack || row.removed_at || row.origin !== "code" || isCorePack(pack)) continue;
    if (activeTriggers(pack, input.activeCodes).length > 0) continue;
    endPacks.push({ packKey: pack.key, reason: endedReasonFor(pack, input) });
  }

  const ending = new Set(endPacks.map((e) => e.packKey));
  const active = new Set(addPacks);
  for (const row of input.clientPacks) {
    if (!row.removed_at && !ending.has(row.pack_key)) active.add(row.pack_key);
  }
  const activePackKeys = CLIENT_PACKS.map((p) => p.key).filter((k) => active.has(k));
  const requiredKeys = requiredKeysFor(activePackKeys, input.activeCodes, input.ownGuardian);
  const required = new Set(requiredKeys);

  const itemByKey = new Map(input.items.map((i) => [i.requirement_key, i]));
  const addKeys = requiredKeys.filter((k) => !itemByKey.has(k));
  const restoreItemIds: string[] = [];
  const retireItems: PackPlan["retireItems"] = [];

  for (const item of input.items) {
    const key = item.requirement_key;
    if (required.has(key)) {
      if (item.opted_out_at && isAutoReason(item.opt_out_reason)) restoreItemIds.push(item.id);
      continue;
    }
    if (item.opted_out_at || item.added_by_hand) continue;
    retireItems.push({ id: item.id, reason: retireReason(key, input, endPacks) });
  }

  return { addPacks, endPacks, activePackKeys, requiredKeys, addKeys, restoreItemIds, retireItems };
}

function retireReason(key: string, input: PackPlanInput, endPacks: PackPlan["endPacks"]): string {
  if (key === GUARDIAN_KEY && input.ownGuardian) return OWN_GUARDIAN_REASON;
  if (RESIDENTIAL_ONLY_KEYS.has(key) && !hasResidentialCode(input.activeCodes)) {
    return residentialEndedReason(input);
  }
  const ended = endPacks.find((e) => clientPack(e.packKey)?.requirementKeys.includes(key));
  return ended ? ended.reason : PACK_REMOVED_REASON;
}
