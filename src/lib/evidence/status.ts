import { effectiveAttentionDate, parseIsoDate } from "./due.ts";
import type { EvidenceCellStatus, EvidenceFileRow, EvidenceItemRow } from "./types.ts";

export type { EvidenceCellStatus };

export function staffInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function addCadence(fromIso: string, cadence: string): string | null {
  const start = new Date(`${fromIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  if (cadence === "once" || cadence === "keep_current") return null;
  const next = new Date(start);
  if (cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else if (cadence === "quarterly") next.setUTCMonth(next.getUTCMonth() + 3);
  else if (cadence === "semi_annual") next.setUTCMonth(next.getUTCMonth() + 6);
  else if (cadence === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else if (cadence === "every_2_years") next.setUTCFullYear(next.getUTCFullYear() + 2);
  else if (cadence === "every_5_years") next.setUTCFullYear(next.getUTCFullYear() + 5);
  else return null;
  return next.toISOString().slice(0, 10);
}

export function latestFileForItem(
  files: readonly EvidenceFileRow[],
  itemId: string,
): EvidenceFileRow | null {
  const rows = files.filter((f) => f.item_id === itemId);
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => {
    const a = best.uploaded_at ?? best.attested_at ?? best.id;
    const b = row.uploaded_at ?? row.attested_at ?? row.id;
    return b > a ? row : best;
  });
}

export function itemHasCompletedEvidence(
  item: EvidenceItemRow,
  file: EvidenceFileRow | null,
): boolean {
  if (!file) return false;
  if (item.evidence_type === "attestation") return !!file.attested_at;
  return !!(file.storage_path || file.filename);
}

export function cellStatus(args: {
  item: EvidenceItemRow | null;
  file: EvidenceFileRow | null;
  today: string;
}): EvidenceCellStatus {
  const { item, file, today } = args;
  const onFile = !!item && itemHasCompletedEvidence(item, file);
  if (!item || !onFile) return "missing";
  const due = effectiveAttentionDate({
    hasFile: true,
    firstDueOn: item.first_due_on,
    nextDueOn: item.next_due_on,
    expiresOn: item.expires_on,
  });
  const dueDay = parseIsoDate(due);
  if (dueDay && dueDay < today) return "missing";
  return "done";
}

export function statusLabel(status: EvidenceCellStatus): string {
  if (status === "done") return "On file";
  if (status === "expiring") return "Needs attention";
  return "Needs attention";
}

export function formatExpiresOn(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
