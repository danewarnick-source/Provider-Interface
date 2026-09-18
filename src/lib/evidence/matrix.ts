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

/** Closed-row summary chips — counts by status, never an n/m fraction. */
export function rowSummaryChips(chips: readonly EvidenceMatrixChip[]): EvidenceMatrixChip[] {
  const assigned = chips.filter((chip) => chip.kind !== "na");
  if (assigned.length === 0) return [];

  const missing = assigned.filter((chip) => chip.kind === "missing").length;
  const due = assigned.filter((chip) => chip.kind === "due");
  const review = assigned.filter((chip) => chip.kind === "review").length;
  const add = assigned.filter((chip) => chip.kind === "add").length;
  const complete = assigned.filter((chip) => chip.kind === "complete").length;
  const summary: EvidenceMatrixChip[] = [];

  if (missing > 0) {
    summary.push({
      kind: "missing",
      label: missing === 1 ? "Missing" : `${missing} missing`,
      itemId: null,
    });
  }
  if (due.length > 0) {
    summary.push({
      kind: "due",
      label: due.length === 1 ? due[0]!.label : "Due soon",
      itemId: null,
    });
  }
  if (review > 0) {
    summary.push({
      kind: "review",
      label: review === 1 ? "Review" : `${review} review`,
      itemId: null,
    });
  }
  if (add > 0 && missing === 0 && due.length === 0) {
    summary.push({ kind: "add", label: "Add", itemId: null });
  }
  if (summary.length === 0 && complete === assigned.length) {
    summary.push({ kind: "complete", label: "Complete", itemId: null });
  }
  return summary;
}
