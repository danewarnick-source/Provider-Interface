// Header badges on the team member profile. Pure: reads only Evidence rows
// (evidence_items / evidence_files for subject 'staff'), through the same
// status helpers the Evidence page uses. Never reads company_obligation_*.

import { parseIsoDate } from "../evidence/due.ts";
import { latestFileForItem, matrixChip } from "../evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";

export type BadgeTone = "ok" | "warn" | "bad" | "muted";

export type ProfileBadge = {
  key: "background" | "oig" | "drive" | "no_pack";
  label: string;
  tone: BadgeTone;
  /** Extra detail for a tooltip. */
  title?: string;
};

/** evidence_items plus the skip columns a later step adds (read when present). */
export type BadgeEvidenceItem = EvidenceItemRow & {
  opted_out_at?: string | null;
  opted_out_by?: string | null;
};

export const BACKGROUND_KEY = "background_screening";
export const OIG_KEY = "oig_exclusion";
export const DRIVER_LICENSE_KEY = "driver_license";
export const AUTO_INSURANCE_KEY = "auto_insurance_proof";
export const TRANSPORT_KEYS = [DRIVER_LICENSE_KEY, AUTO_INSURANCE_KEY] as const;

/** "2026-03-04" → the viewer's local date (no UTC day shift). "" when unparseable. */
export function formatLocalDate(ymd: string | null | undefined): string {
  const day = parseIsoDate(ymd ?? null);
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString();
}

/** Whole years between a YYYY-MM-DD birth date and today (YYYY-MM-DD). Null when unknown. */
export function ageOn(dateOfBirth: string | null | undefined, today: string): number | null {
  const dob = parseIsoDate(dateOfBirth ?? null);
  const now = parseIsoDate(today);
  if (!dob || !now) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = now.split("-").map(Number);
  let age = ty! - by!;
  if (tm! < bm! || (tm === bm && td! < bd!)) age -= 1;
  return age;
}

function itemFor(items: readonly BadgeEvidenceItem[], key: string): BadgeEvidenceItem | null {
  return items.find((i) => i.requirement_key === key) ?? null;
}

/** The date a completed item is "on file": document date, else when it was filed. */
function onFileDate(item: EvidenceItemRow, file: EvidenceFileRow | null): string | null {
  return (
    parseIsoDate(item.document_date) ??
    parseIsoDate(file?.uploaded_at?.slice(0, 10) ?? null) ??
    parseIsoDate(file?.attested_at?.slice(0, 10) ?? null)
  );
}

/** Complete per the Evidence page chip (on file and not past due). */
export function evidenceItemDone(
  items: readonly BadgeEvidenceItem[],
  files: readonly EvidenceFileRow[],
  key: string,
  today: string,
): boolean {
  const item = itemFor(items, key);
  if (!item || item.opted_out_at) return false;
  return matrixChip({ item, file: latestFileForItem(files, item.id), today }).kind === "complete";
}

/**
 * One Evidence item as a header badge:
 *   complete → "{prefix} on file {date}" / "{prefix} checked {date}"
 *   due, add, review → "{prefix} due"
 *   no row, past due, expired → "{prefix} missing"
 *   skipped (opted out) → "{prefix} skipped by {name}"
 */
export function evidenceItemBadge(args: {
  key: "background" | "oig";
  requirementKey: string;
  prefix: string;
  doneVerb: string;
  items: readonly BadgeEvidenceItem[];
  files: readonly EvidenceFileRow[];
  today: string;
  nameOf?: (userId: string) => string | null;
}): ProfileBadge {
  const { key, prefix, doneVerb, items, files, today } = args;
  const item = itemFor(items, args.requirementKey);
  if (item?.opted_out_at) {
    const by = item.opted_out_by ? (args.nameOf?.(item.opted_out_by) ?? null) : null;
    return {
      key,
      label: by ? `${prefix} skipped by ${by}` : `${prefix} skipped`,
      tone: "muted",
    };
  }
  if (!item) return { key, label: `${prefix} missing`, tone: "bad" };
  const file = latestFileForItem(files, item.id);
  const chip = matrixChip({ item, file, today });
  if (chip.kind === "complete") {
    const date = formatLocalDate(onFileDate(item, file));
    return {
      key,
      label: date ? `${prefix} ${doneVerb} ${date}` : `${prefix} ${doneVerb}`,
      tone: "ok",
    };
  }
  if (chip.kind === "due" || chip.kind === "add" || chip.kind === "review") {
    return { key, label: `${prefix} due`, tone: "warn", title: chip.label };
  }
  return { key, label: `${prefix} missing`, tone: "bad" };
}

export type DriveCheck = {
  /** Render at all: only for people marked Transports clients. */
  show: boolean;
  ok: boolean;
  /** What is still missing, in plain words. */
  missing: string[];
};

/** Transports clients + 18 or older + driver's license and auto insurance both complete. */
export function driveCheck(args: {
  transportsClients: boolean;
  dateOfBirth: string | null;
  items: readonly BadgeEvidenceItem[];
  files: readonly EvidenceFileRow[];
  today: string;
}): DriveCheck {
  if (!args.transportsClients) return { show: false, ok: false, missing: [] };
  const missing: string[] = [];
  const age = ageOn(args.dateOfBirth, args.today);
  if (age === null) missing.push("Date of birth");
  else if (age < 18) missing.push("Must be 18 or older");
  if (!evidenceItemDone(args.items, args.files, DRIVER_LICENSE_KEY, args.today)) {
    missing.push("Driver's license");
  }
  if (!evidenceItemDone(args.items, args.files, AUTO_INSURANCE_KEY, args.today)) {
    missing.push("Auto insurance");
  }
  return { show: true, ok: missing.length === 0, missing };
}

/** Every header badge, in display order. */
export function profileBadges(args: {
  items: readonly BadgeEvidenceItem[];
  files: readonly EvidenceFileRow[];
  today: string;
  transportsClients: boolean;
  dateOfBirth: string | null;
  nameOf?: (userId: string) => string | null;
}): ProfileBadge[] {
  const { items, files, today, nameOf } = args;
  const out: ProfileBadge[] = [
    evidenceItemBadge({
      key: "background",
      requirementKey: BACKGROUND_KEY,
      prefix: "Background",
      doneVerb: "on file",
      items,
      files,
      today,
      nameOf,
    }),
    evidenceItemBadge({
      key: "oig",
      requirementKey: OIG_KEY,
      prefix: "OIG",
      doneVerb: "checked",
      items,
      files,
      today,
      nameOf,
    }),
  ];
  const drive = driveCheck(args);
  if (drive.show) {
    out.push(
      drive.ok
        ? { key: "drive", label: "Can drive clients", tone: "ok" }
        : {
            key: "drive",
            label: "Can't drive clients yet",
            tone: "warn",
            title: `Missing: ${drive.missing.join(", ")}`,
          },
    );
  }
  if (items.length === 0) out.push({ key: "no_pack", label: "No evidence pack", tone: "muted" });
  return out;
}

/**
 * "New suggestion: transport items" — Transports clients is on and the person
 * already has an evidence pack that lacks the license / insurance rows.
 */
export function needsTransportSuggestion(
  transportsClients: boolean,
  items: readonly Pick<EvidenceItemRow, "requirement_key">[],
): boolean {
  if (!transportsClients || items.length === 0) return false;
  const keys = new Set(items.map((i) => i.requirement_key));
  return TRANSPORT_KEYS.some((k) => !keys.has(k));
}
