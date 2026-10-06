import { effectiveAttentionDate, parseIsoDate } from "./due.ts";
import type {
  EvidenceCellStatus,
  EvidenceFileRow,
  EvidenceItemRow,
  EvidenceReviewStatus,
} from "./types.ts";

export type { EvidenceCellStatus };

/** Presentation chips for an Evidence item. Derived from existing due/file fields. */
export const EVIDENCE_MATRIX_CHIP_KINDS = [
  "complete",
  "due",
  "missing",
  "review",
  "add",
  "open",
  "na",
  "awaiting_review",
  "sent_back",
  "skipped",
] as const;
export type EvidenceMatrixChipKind = (typeof EVIDENCE_MATRIX_CHIP_KINDS)[number];

export type EvidenceMatrixChip = {
  kind: EvidenceMatrixChipKind;
  label: string;
  itemId: string | null;
};

export function staffInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
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

/** Review state of a file. Rows from before review existed (or slim selects) are accepted. */
export function fileReviewStatus(file: EvidenceFileRow | null): EvidenceReviewStatus | null {
  if (!file) return null;
  return file.review_status ?? "accepted";
}

/** True when the item was skipped (opted out). */
export function isEvidenceSkipped(item: EvidenceItemRow | null): boolean {
  return !!item?.opted_out_at;
}

/**
 * True when the item's latest file satisfies it (attested, or an upload on file)
 * AND an admin has accepted it. A pending or sent-back upload is not done.
 */
export function itemHasCompletedEvidence(
  item: EvidenceItemRow,
  file: EvidenceFileRow | null,
): boolean {
  if (!file) return false;
  if (fileReviewStatus(file) !== "accepted") return false;
  if (item.evidence_type === "attestation") return !!file.attested_at;
  return !!(file.storage_path || file.filename);
}

export function cellStatus(args: {
  item: EvidenceItemRow | null;
  file: EvidenceFileRow | null;
  today: string;
}): EvidenceCellStatus {
  const { item, file, today } = args;
  if (isEvidenceSkipped(item)) return "skipped";
  const review = fileReviewStatus(file);
  if (item && review === "pending") return "awaiting_review";
  if (item && review === "sent_back") return "sent_back";
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

export function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function dueChipLabel(days: number): string {
  if (days <= 0) return "Due today";
  return `Due in ${days}d`;
}

/**
 * Chip for one assigned evidence item (or N/A when the person has no row).
 * Does not invent new due rules: N/A = not on this pack; Add = assigned, empty, no date;
 * Review = sent to the employee and still empty; Due in Nd = upcoming first/attention date
 * before anything is on file; Skipped / Awaiting review / Sent back mirror cellStatus();
 * Complete / Missing follow cellStatus().
 */
export function matrixChip(args: {
  item: EvidenceItemRow | null;
  file: EvidenceFileRow | null;
  today: string;
}): EvidenceMatrixChip {
  const { item, file, today } = args;
  if (!item) return { kind: "na", label: "N/A", itemId: null };
  if (isEvidenceSkipped(item)) return { kind: "skipped", label: "Skipped", itemId: item.id };
  const review = fileReviewStatus(file);
  if (review === "pending") {
    return { kind: "awaiting_review", label: "Awaiting review", itemId: item.id };
  }
  if (review === "sent_back") return { kind: "sent_back", label: "Sent back", itemId: item.id };

  const onFile = itemHasCompletedEvidence(item, file);
  const due = effectiveAttentionDate({
    hasFile: onFile,
    firstDueOn: item.first_due_on,
    nextDueOn: item.next_due_on,
    expiresOn: item.expires_on,
  });
  const dueDay = parseIsoDate(due);
  const days = dueDay ? daysBetweenIso(today, dueDay) : null;

  if (!onFile && item.sent_to_staff) {
    return { kind: "review", label: "Review", itemId: item.id };
  }
  if (!onFile && days === null) {
    return { kind: "add", label: "Add", itemId: item.id };
  }
  if (!onFile && days !== null && days >= 0) {
    return { kind: "due", label: dueChipLabel(days), itemId: item.id };
  }

  const base = cellStatus({ item, file, today });
  if (base === "done") {
    return { kind: "complete", label: "Complete", itemId: item.id };
  }
  return { kind: "missing", label: "Missing", itemId: item.id };
}

export const EVIDENCE_CELL_STATUS_LABEL: Record<EvidenceCellStatus, string> = {
  done: "On file",
  missing: "Needs attention",
  awaiting_review: "Awaiting review",
  sent_back: "Sent back",
  skipped: "Skipped",
};

export function statusLabel(status: EvidenceCellStatus): string {
  return EVIDENCE_CELL_STATUS_LABEL[status];
}

export function formatExpiresOn(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
