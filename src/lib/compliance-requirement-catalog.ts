/**
 * Locked DHHS91172 layered-SOW overlay for the unified register.
 *
 * Titles and citations come from sow-obligation-catalog.ts — this file does
 * not invent SOW body text. Phase 2 seeds platform requirement_defs
 * (organization_id IS NULL) from these rows.
 *
 * Trackable set = obligation + standing + intake.
 * retired and by_design (code-specific work-product) stay off this catalog.
 */

import { perHomeServiceCode } from "./obligation-assignee-rules.ts";
import {
  TRANSPORT_OPT_OUT_FACT_KEY,
  type ComplianceRequirementLayer,
  type ComplianceSubjectKind,
} from "./compliance-store.ts";
import {
  allSowCatalogEntries,
  sowCatalogEntry,
  sowCatalogEntryByKey,
  type SowCatalogEntry,
} from "./sow-obligation-catalog.ts";

export const STAFF_EXCEPTION_KEYS = new Set([
  "abi_training",
  "behavior_intervention_cert",
  "driving_record_transport",
]);

export const STAFF_SHELF_KEYS = new Set([
  "educational_credentials",
  "training_file_maintained",
  "staff_minimum_age",
]);

const GATE_FACT_BY_KEY: Record<string, string> = {
  driving_record_transport: TRANSPORT_OPT_OUT_FACT_KEY,
  volunteer_training_file: "uses_volunteers",
  governing_board_records: "has_governing_board",
  zoning_life_safety: "operates_ol_site",
  abi_training: "abi_caseload",
  behavior_intervention_cert: "behavior_caseload",
};

export type PlatformRequirementDef = {
  requirementKey: string;
  subjectKind: ComplianceSubjectKind;
  layer: ComplianceRequirementLayer;
  title: string;
  sourceSowCite: string;
  gateFactKey: string | null;
  defaultOn: boolean;
};

export function isTrackableSowDisposition(
  disposition: SowCatalogEntry["disposition"] | string | null | undefined,
): boolean {
  return disposition === "obligation" || disposition === "standing" || disposition === "intake";
}

export function layerForSowEntry(entry: SowCatalogEntry): ComplianceRequirementLayer {
  if (STAFF_EXCEPTION_KEYS.has(entry.key)) return "staff_exception";
  if (STAFF_SHELF_KEYS.has(entry.key)) return "staff_shelf";
  if (entry.owner === "staff" && entry.service_codes.length > 0) return "staff_exception";
  if (
    entry.category === "client_docs" ||
    entry.title.includes("[Client Name]") ||
    entry.disposition === "intake"
  ) {
    return "client_shelf";
  }
  if (entry.owner === "staff" && entry.disposition === "obligation") return "all_staff_clock";
  return "company_standing";
}

export function subjectKindForSowEntry(entry: SowCatalogEntry): ComplianceSubjectKind {
  const layer = layerForSowEntry(entry);
  if (layer === "client_shelf") return "client";
  if (layer === "company_standing") {
    return perHomeServiceCode(entry.key) ? "site" : "org";
  }
  return "staff";
}

export function gateFactKeyForSowEntry(entry: SowCatalogEntry): string | null {
  return GATE_FACT_BY_KEY[entry.key] ?? null;
}

export function platformRequirementDefFromEntry(entry: SowCatalogEntry): PlatformRequirementDef {
  return {
    requirementKey: entry.key,
    subjectKind: subjectKindForSowEntry(entry),
    layer: layerForSowEntry(entry),
    title: entry.title,
    sourceSowCite: entry.citation,
    gateFactKey: gateFactKeyForSowEntry(entry),
    defaultOn: true,
  };
}

export function platformRequirementDefs(): PlatformRequirementDef[] {
  return allSowCatalogEntries()
    .filter((entry) => isTrackableSowDisposition(entry.disposition))
    .map(platformRequirementDefFromEntry)
    .sort((a, b) => a.requirementKey.localeCompare(b.requirementKey));
}

export function platformRequirementDefByKey(key: string): PlatformRequirementDef | null {
  const entry = sowCatalogEntryByKey(key);
  if (!entry || !isTrackableSowDisposition(entry.disposition)) return null;
  return platformRequirementDefFromEntry(entry);
}

export function resolveLockedSowEntry(ob: {
  title?: string | null;
  key?: string | null;
}): SowCatalogEntry | null {
  const fromKey = ob.key ? sowCatalogEntryByKey(ob.key) : null;
  const entry = fromKey ?? (ob.title ? sowCatalogEntry(ob.title) : null);
  if (!entry) return null;
  if (!isTrackableSowDisposition(entry.disposition)) return null;
  return entry;
}

export const IN_HIVE_COURSE_REQUIREMENT_KEY = {
  "thirty-day": "orientation_30_day",
  abi: "abi_training",
  "pi-person-centered-foundations": "pct_hire_practices",
} as const;

export function requirementKeyForInHiveCourse(
  courseId: string,
): string | null {
  if (courseId === "thirty-day") return IN_HIVE_COURSE_REQUIREMENT_KEY["thirty-day"];
  if (courseId === "abi") return IN_HIVE_COURSE_REQUIREMENT_KEY.abi;
  if (courseId === "pi-person-centered-foundations") {
    return IN_HIVE_COURSE_REQUIREMENT_KEY["pi-person-centered-foundations"];
  }
  return null;
}

export function requirementKeyForClientTrainingType(
  trainingType: "person_specific" | "support_strategies" | "person_centered" | string,
): string | null {
  if (trainingType === "person_specific") return "client_specific_training";
  if (trainingType === "support_strategies") return "support_strategies";
  return null;
}
