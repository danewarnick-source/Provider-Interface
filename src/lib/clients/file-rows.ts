// The Client file, read from Evidence. Pure: turns the client's Evidence
// items and files, plus the pack plan (file-packs.ts), into rows grouped by
// pack. Each row carries its title, the catalog `why`, a status (On file ·
// expires <date> / Missing / Not needed: <reason> / Optional) and how to
// fix it. Also gives the Overview its "Needs attention" file items, where a
// row marked Not needed never counts.

import { requirementByKey } from "../evidence/catalog.ts";
import { effectiveAttentionDate } from "../evidence/due.ts";
import { cellStatus, itemHasCompletedEvidence, latestFileForItem } from "../evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";
import { formatDate } from "./dates.ts";
import {
  CLIENT_PACKS,
  activeTriggers,
  isCorePack,
  requiredKeysFor,
  type ClientPackRow,
  type PackPlan,
} from "./file-packs.ts";
import type { ClientProfileSection } from "./profile-sections.ts";

export type ClientFileRowState =
  | "on_file"
  | "due_soon"
  | "missing"
  | "awaiting_review"
  | "sent_back"
  | "not_needed"
  | "optional";

export type ClientFileRow = {
  key: string;
  /** Null until the item is saved (a code just added it). */
  itemId: string | null;
  title: string;
  why: string;
  /** Small "SOW §1.10(11)" hint, only for a single confirmed section. */
  sowHint: string | null;
  state: ClientFileRowState;
  label: string;
  /** Why it's not needed (a person's reason, or PI's: "HHS ended Aug 31, 2026"). */
  reason: string | null;
  expiresOn: string | null;
  evidenceType: "upload" | "attestation";
  file: { path: string | null; filename: string | null } | null;
  /** Kept in another section of the profile (photo, PCSP, strategies). */
  keptIn: ClientProfileSection | null;
  /** Kept in this section's own card (belongings inventory). */
  keptHere: boolean;
  /** A line from where it is kept ("Sent to Angela Duty · Oct 8, 2026 · Dane Warnick"). */
  note: string | null;
  optional: boolean;
  addedByHand: boolean;
};

export type ClientFileGroup = {
  key: string;
  title: string;
  description: string;
  /** "Every client" / "From HHS" / "Added by hand" / "Not needed any more". */
  origin: string;
  rows: ClientFileRow[];
};

/** Records the profile keeps elsewhere; their status comes from there too. */
export const KEPT_IN: Readonly<Record<string, ClientProfileSection>> = {
  client_photo: "profile",
  client_pcsp: "plans",
  support_strategies: "plans",
};
export const KEPT_HERE = new Set([
  "belongings_inventory_hhs",
  "belongings_inventory_rhs",
  "belongings_inventory_pps",
]);
/** Shown elsewhere on the Overview already (photo, plan year, strategies). */
const NOT_IN_ATTENTION = new Set(Object.keys(KEPT_IN));

export const DUE_SOON_DAYS = 30;

/**
 * Status from where a record is kept. `ruled`: that status is the only rule
 * (support strategies sent to the support coordinator, strategy-sends.ts), so
 * an older Evidence file on the row doesn't count by itself.
 */
export type ElsewhereFacts = Partial<
  Record<string, { onFile: boolean; dueOn: string | null; note?: string | null; ruled?: boolean }>
>;

/** "SOW §1.10(11)" when the cite names one section; vague cites get no hint. */
export function sowHint(cite: string | null | undefined): string | null {
  const c = (cite ?? "").trim();
  return /^SOW §\d+\.\d+(\.\d+)?(\([0-9a-z]+\))*$/i.test(c) ? c : null;
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function stateFor(onFile: boolean, expiresOn: string | null, today: string): ClientFileRowState {
  if (expiresOn && expiresOn < today) return "missing";
  if (!onFile) return "missing";
  return expiresOn && expiresOn <= addDays(today, DUE_SOON_DAYS) ? "due_soon" : "on_file";
}

function labelFor(state: ClientFileRowState, expiresOn: string | null, reason: string | null) {
  switch (state) {
    case "on_file":
      return expiresOn ? `On file · expires ${formatDate(expiresOn)}` : "On file";
    case "due_soon":
      return `Expires ${formatDate(expiresOn)}`;
    case "missing":
      return expiresOn ? `Expired ${formatDate(expiresOn)}` : "Missing";
    case "awaiting_review":
      return "Awaiting review";
    case "sent_back":
      return "Sent back";
    case "optional":
      return "Optional";
    case "not_needed":
      return `Not needed: ${reason ?? "no reason given"}`;
  }
}

/** A ruled row has a due date, not an expiry: "On file", "Due Oct 20, 2026", "Overdue (due …)". */
function ruledLabel(onFile: boolean, dueOn: string | null, today: string): string {
  if (onFile) return "On file";
  if (!dueOn) return "Missing";
  return dueOn >= today ? `Due ${formatDate(dueOn)}` : `Overdue (due ${formatDate(dueOn)})`;
}

export type RowInput = {
  key: string;
  item: EvidenceItemRow | null;
  files: readonly EvidenceFileRow[];
  /** Set when the row is (or is about to be) marked Not needed. */
  notNeeded: string | null;
  elsewhere: ElsewhereFacts;
  today: string;
};

export function buildRow({
  key,
  item,
  files,
  notNeeded,
  elsewhere,
  today,
}: RowInput): ClientFileRow {
  const def = requirementByKey(key);
  const file = item ? latestFileForItem(files, item.id) : null;
  const optional = !!def?.optional;
  const fact = elsewhere[key];
  const ruled = !!fact?.ruled;
  const done = !ruled && !!item && itemHasCompletedEvidence(item, file);
  const expiresOn =
    (!ruled &&
      item &&
      effectiveAttentionDate({
        hasFile: done,
        firstDueOn: item.first_due_on,
        nextDueOn: item.next_due_on,
        expiresOn: item.expires_on,
      })) ||
    fact?.dueOn ||
    null;
  let state: ClientFileRowState;
  if (notNeeded) state = "not_needed";
  else if (ruled) {
    state = fact!.onFile ? "on_file" : expiresOn && expiresOn >= today ? "due_soon" : "missing";
  } else {
    const cell = item ? cellStatus({ item, file, today }) : "missing";
    if (cell === "awaiting_review" || cell === "sent_back") state = cell;
    else state = stateFor(done || !!fact?.onFile, expiresOn, today);
    if (optional && state === "missing" && !expiresOn) state = "optional";
  }
  return {
    key,
    itemId: item?.id ?? null,
    title: item?.title || def?.title || key,
    why: def?.why ?? item?.description ?? "",
    sowHint: sowHint(def?.sowCite ?? item?.sow_cite),
    state,
    label:
      ruled && !notNeeded
        ? ruledLabel(fact!.onFile, expiresOn, today)
        : labelFor(state, expiresOn, notNeeded),
    reason: notNeeded,
    expiresOn,
    evidenceType: item?.evidence_type ?? def?.evidenceType ?? "upload",
    file:
      file && (file.storage_path || file.filename) && !(ruled && !fact?.onFile)
        ? { path: file.storage_path, filename: file.filename }
        : null,
    keptIn: KEPT_IN[key] ?? null,
    keptHere: KEPT_HERE.has(key),
    note: fact?.note ?? null,
    optional,
    addedByHand: !!item?.added_by_hand,
  };
}

/** "From HHS", "Every client" or "Added by hand" for a pack on this client. */
export function packOrigin(packKey: string, activeCodes: readonly string[]): string {
  const pack = CLIENT_PACKS.find((p) => p.key === packKey);
  if (!pack) return "Added by hand";
  if (isCorePack(pack)) return "Every client";
  const codes = activeTriggers(pack, activeCodes);
  return codes.length ? `From ${codes.join(", ")}` : "Added by hand";
}

export type ClientFileInput = {
  items: readonly EvidenceItemRow[];
  files: readonly EvidenceFileRow[];
  plan: PackPlan;
  clientPacks: readonly ClientPackRow[];
  activeCodes: readonly string[];
  ownGuardian: boolean;
  elsewhere: ElsewhereFacts;
  today: string;
};

/** The Client file: one group per pack, then hand-added items, then rows no longer needed. */
export function buildClientFile(input: ClientFileInput): ClientFileGroup[] {
  const itemByKey = new Map(input.items.map((i) => [i.requirement_key, i]));
  const retired = new Map(input.plan.retireItems.map((r) => [r.id, r.reason]));
  const restored = new Set(input.plan.restoreItemIds);
  const notNeededOf = (item: EvidenceItemRow | null): string | null => {
    if (!item) return null;
    if (retired.has(item.id)) return retired.get(item.id)!;
    if (restored.has(item.id) || !item.opted_out_at) return null;
    return item.opt_out_reason ?? "no reason given";
  };
  const row = (key: string) => {
    const item = itemByKey.get(key) ?? null;
    const { files, elsewhere, today } = input;
    return buildRow({ key, item, files, notNeeded: notNeededOf(item), elsewhere, today });
  };

  const shown = new Set<string>();
  const groups: ClientFileGroup[] = [];
  for (const packKey of input.plan.activePackKeys) {
    const pack = CLIENT_PACKS.find((p) => p.key === packKey);
    if (!pack) continue;
    const keys = requiredKeysFor([packKey], input.activeCodes, input.ownGuardian).filter(
      (k) => !shown.has(k),
    );
    keys.forEach((k) => shown.add(k));
    groups.push({
      key: packKey,
      title: pack.title,
      description: pack.description,
      origin: packOrigin(packKey, input.activeCodes),
      rows: keys.map(row),
    });
  }
  const rest = input.items.filter((i) => !shown.has(i.requirement_key));
  const byHand = rest.filter((i) => i.added_by_hand && !notNeededOf(i));
  if (byHand.length) {
    groups.push({
      key: "by_hand",
      title: "Added by hand",
      description: "Items your agency added for this client.",
      origin: "Added by hand",
      rows: byHand.map((i) => row(i.requirement_key)),
    });
  }
  const gone = rest.filter((i) => !byHand.includes(i));
  if (gone.length) {
    groups.push({
      key: "not_needed",
      title: "Not needed any more",
      description: "Kept on record with their files. Nothing here counts as missing.",
      origin: "Not needed any more",
      rows: gone.map((i) => row(i.requirement_key)),
    });
  }
  return groups;
}

export type FileAttentionCard = {
  key: string;
  title: string;
  status: "missing" | "due_soon";
  dueAt: string | null;
};

/** Needs attention: Missing, expiring or sent-back rows. Not needed and optional rows never count. */
export function fileAttention(groups: readonly ClientFileGroup[]): FileAttentionCard[] {
  const out: FileAttentionCard[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      if (NOT_IN_ATTENTION.has(r.key) || r.optional) continue;
      if (r.state === "missing" || r.state === "sent_back") {
        out.push({ key: r.key, title: r.title, status: "missing", dueAt: r.expiresOn });
      } else if (r.state === "due_soon") {
        out.push({ key: r.key, title: r.title, status: "due_soon", dueAt: r.expiresOn });
      }
    }
  }
  return out;
}
