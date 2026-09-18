/**
 * Admin Evidence matrix helpers — columns from assigned requirement keys,
 * row labels from existing pack chips. No invented catalog.
 */

import { chipsForRequirementKey, EVIDENCE_REQUIREMENTS, requirementByKey } from "./catalog.ts";
import type { EvidenceDueDefault } from "./due.ts";
import type { EvidenceItemRow, EvidencePerson, FirstDueRule, RenewYears } from "./types.ts";

export type EvidenceMatrixColumn = {
  key: string;
  title: string;
  subtitle: string;
};

const CATALOG_KEY_ORDER = EVIDENCE_REQUIREMENTS.map((row) => row.key);

export function columnDueHint(args: {
  firstDueRule?: FirstDueRule | null;
  renewYears?: RenewYears;
}): string {
  const rule = args.firstDueRule;
  const first =
    rule === "hire_30"
      ? "30-day"
      : rule === "hire_90"
        ? "90-day"
        : rule === "hire_180"
          ? "180-day"
          : rule === "before_first_shift"
            ? "On hire"
            : "Set a date";
  if (args.renewYears === 2) return `${first} · 2 yr`;
  if (args.renewYears === 1) return `${first} · 1 yr`;
  return first;
}

function dueFromItem(item: EvidenceItemRow): EvidenceDueDefault {
  return {
    firstDueRule:
      item.first_due_rule ?? (item.subject_type === "staff" ? "before_first_shift" : "set_date"),
    renewYears: item.renew_years === 1 || item.renew_years === 2 ? item.renew_years : null,
  };
}

export function matrixColumnForKey(
  key: string,
  sample: EvidenceItemRow | undefined,
): EvidenceMatrixColumn {
  const def = requirementByKey(key);
  const due = def?.dueDefault ?? (sample ? dueFromItem(sample) : null);
  const hint = due ? columnDueHint(due) : "Set a date";
  const packChips = chipsForRequirementKey(key);
  const subtitle =
    packChips.length === 1 && (hint === "On hire" || hint === "Set a date")
      ? packChips[0]!
      : hint;
  return {
    key,
    title: def?.shortLabel ?? sample?.title ?? key,
    subtitle,
  };
}

/** Union of requirement keys on visible subjects, catalog order then leftover titles. */
export function matrixColumns(items: readonly EvidenceItemRow[]): EvidenceMatrixColumn[] {
  const sampleByKey = new Map<string, EvidenceItemRow>();
  for (const item of items) {
    if (!sampleByKey.has(item.requirement_key)) sampleByKey.set(item.requirement_key, item);
  }
  const remaining = new Set(sampleByKey.keys());
  const ordered: EvidenceMatrixColumn[] = [];
  for (const key of CATALOG_KEY_ORDER) {
    if (!remaining.has(key)) continue;
    ordered.push(matrixColumnForKey(key, sampleByKey.get(key)));
    remaining.delete(key);
  }
  const leftovers = [...remaining]
    .map((key) => matrixColumnForKey(key, sampleByKey.get(key)))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...leftovers];
}

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
  const packLine =
    chips.length === 0
      ? "no packs yet"
      : chips.length <= 3
        ? chips.join(" · ")
        : `${chips.length} selected packs`;
  const role = (args.person.subtitle ?? "").trim();
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

export function itemForRequirement(
  rows: readonly EvidenceItemRow[] | undefined,
  requirementKey: string,
): EvidenceItemRow | null {
  return rows?.find((row) => row.requirement_key === requirementKey) ?? null;
}
