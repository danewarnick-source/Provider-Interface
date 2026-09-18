/**
 * Admin Evidence roster helpers — pack labels and per-person summaries.
 * No shared requirement columns: people keep their own item lists.
 */

import { chipsForRequirementKey } from "./catalog.ts";
import type { EvidenceMatrixChip } from "./status.ts";
import type { EvidenceItemRow, EvidencePerson } from "./types.ts";

export function packChipsForKeys(keys: readonly string[]): string[] {
  const chips = new Set<string>();
  for (const key of keys) {
    for (const chip of chipsForRequirementKey(key)) chips.add(chip);
  }
  return [...chips];
}

export function personRowSubtitle(args: {
  person: EvidencePerson;
  requirementKeys: readonly string[];
}): string {
  const chips = packChipsForKeys(args.requirementKeys);
  const role = (args.person.subtitle ?? "").trim();
  if (chips.length === 0) return role ? `${role} · no packs yet` : "no packs yet";
  const packLine = chips.length <= 3 ? chips.join(" · ") : chips.slice(0, 3).join(" · ");
  if (role) return `${role} · ${packLine}`;
  return packLine;
}

export function itemsBySubject(items: readonly EvidenceItemRow[]): Map<string, EvidenceItemRow[]> {
  const map = new Map<string, EvidenceItemRow[]>();
  for (const item of items) {
    const rows = map.get(item.subject_id) ?? [];
    rows.push(item);
    map.set(item.subject_id, rows);
  }
  return map;
}

/** Closed-row status — one muted count. Never a red overdue/missing pill. */
export function rowSummaryChips(chips: readonly EvidenceMatrixChip[]): EvidenceMatrixChip[] {
  const assigned = chips.filter((chip) => chip.kind !== "na");
  if (assigned.length === 0) return [];

  const complete = assigned.filter((chip) => chip.kind === "complete").length;
  const toFinish = assigned.length - complete;
  if (toFinish > 0) {
    return [
      {
        kind: "open",
        label: toFinish === 1 ? "1 to finish" : `${toFinish} to finish`,
        itemId: null,
      },
    ];
  }
  if (complete === assigned.length) {
    return [{ kind: "complete", label: "Complete", itemId: null }];
  }
  return [];
}
