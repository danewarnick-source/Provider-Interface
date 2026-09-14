/**
 * Connect imported DHHS91172 catalog parents to the live obligation pack.
 * Reuses company_obligations / My tasks / training / forms / reminders.
 * Elements never mint a second staff task.
 */

import { citationSection } from "./catalog-relation.ts";
import {
  allSowCatalogEntries,
  sowCatalogEntryByKey,
  type SowCatalogEntry,
} from "../sow-obligation-catalog.ts";
import type { CatalogSheetRow, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import type { DraftRule } from "./draft-rules/types.ts";

export const EXPLICIT_REQ_TO_LIVE_KEY: Readonly<Record<string, string>> = {
  "REQ-1.4.1": "medicaid_enrollment",
  "REQ-1.4.2": "usteps_upi_accounts",
  "REQ-1.6": "volunteer_training_file",
  "REQ-1.7.1": "medicaid_101_contractor",
  "REQ-1.7.2": "medicaid_manuals_memo",
  "REQ-1.8.4": "orientation_30_day",
  "REQ-1.8.5": "cpr_first_aid_initial",
  "REQ-1.8.5-cpr-current": "cpr_first_aid_renewal",
  "REQ-1.8.6": "behavior_intervention_cert",
  "REQ-1.8.7": "ce_12h_annual",
  "REQ-1.8.8": "abi_training",
  "REQ-1.9.2": "background_screening_annual",
  "REQ-1.9.3": "training_file_maintained",
  "REQ-1.9.4": "educational_credentials",
  "REQ-1.9.6": "medicaid_disclosure_annual",
  "REQ-1.9.7": "medicaid_exclusion_annual",
  "REQ-1.11": "zoning_life_safety",
  "REQ-1.12": "evv_visit_verification",
  "REQ-1.14": "governing_board_records",
  "REQ-1.17": "personnel_policies",
  "REQ-1.18": "operating_policies",
  "REQ-1.21": "human_rights_plan",
  "REQ-1.21.5": "hrc_committee",
  "REQ-1.22": "person_discharge_process",
  "REQ-1.23": "health_support_policies",
  "REQ-1.27": "incident_reporting_process",
  "REQ-1.30": "driving_record_transport",
  "REQ-1.35": "housemate_informed_choice",
  "REQ-8.6": "dsi_annual_outcome",
  "REQ-11.3": "hhs_evac_drills_quarterly",
  "REQ-11.5": "hhs_home_cert_annual",
  "REQ-11.7": "hhs_annual_outcome",
  "REQ-15.3": "pba_financial_review",
  "REQ-20.3": "pps_evac_drills_quarterly",
  "REQ-20.5": "pps_foster_license",
  "REQ-21.3": "rhs_evac_drills_quarterly",
  "REQ-21.5": "ol_rhs_license_4plus",
  "REQ-30.3": "sei_monthly_summary_upi",
  "REQ-30.5": "sei_ssi_benefits",
  "REQ-30.6.b": "acre_sei",
  "REQ-30.6.c": "acre_sei",
  "REQ-30.7": "sei_annual_outcome",
  "REQ-32.3": "cmp_cms_monthly_summaries",
  "REQ-32.5": "cmp_cms_caregiver_comp",
  "REQ-33.3": "sjd_monthly_summary_upi",
  "REQ-33.5": "acre_sjd",
  "REQ-33.5.b-c": "acre_sjd",
};

export type CatalogRole = "parent" | "element";

export type LiveImplementationStatus =
  | "live_mapped"
  | "live_artifact"
  | "element_of_parent"
  | "system_behavior"
  | "draft_unwired"
  | "blocked";

export type StaffTaskPolicy = {
  role: CatalogRole;
  parentKey: string | null;
  createsUserTask: boolean;
  parentAssignment: "one" | "per_member";
  mintsStaffTask: boolean;
  reason: string;
};

function normalizeSection(value: string): string {
  return value
    .toLowerCase()
    .replace(/^req-/, "")
    .replace(/^sow\s*/, "")
    .replace(/§/g, "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, ".")
    .replace(/\.+$/, "");
}

function rowString(row: CatalogSheetRow | undefined, key: string): string {
  if (!row) return "";
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

export function catalogRoleForRow(row: CatalogSheetRow | undefined): CatalogRole {
  if (!row) return "parent";
  if (row.requirement_role === "element" || row.row_kind === "element") return "element";
  if (row.task_type === "element_of_parent") return "element";
  return "parent";
}

export function parentKeyForElement(row: CatalogSheetRow | undefined): string | null {
  if (!row) return null;
  const parent = rowString(row, "parent_id") || rowString(row, "requirement_key");
  return parent.length > 0 ? parent : null;
}

export function staffTaskPolicy(input: {
  role: CatalogRole;
  parentKey?: string | null;
  createsUserTask?: string | boolean;
  parentAssignment?: "one" | "per_member" | string;
  taskType?: string;
}): StaffTaskPolicy {
  const parentAssignment = input.parentAssignment === "per_member" ? "per_member" : "one";
  const creates =
    input.createsUserTask === true ||
    input.createsUserTask === "yes" ||
    input.createsUserTask === "true";
  if (input.role === "element" || input.taskType === "element_of_parent") {
    return {
      role: "element",
      parentKey: input.parentKey ?? null,
      createsUserTask: false,
      parentAssignment,
      mintsStaffTask: false,
      reason: "Child element belongs on the parent form/course — not a second staff task.",
    };
  }
  if (input.createsUserTask === "no" || input.createsUserTask === false) {
    return {
      role: "parent",
      parentKey: null,
      createsUserTask: false,
      parentAssignment,
      mintsStaffTask: false,
      reason: "Workbook creates_user_task=no — standing/system behavior, no My tasks card.",
    };
  }
  return {
    role: "parent",
    parentKey: null,
    createsUserTask: creates || parentAssignment === "one",
    parentAssignment,
    mintsStaffTask: true,
    reason:
      parentAssignment === "one"
        ? "One parent assignment reuses the live obligation clock."
        : "Per-member assignment still uses the parent live key — not one task per element.",
  };
}

export function staffTaskPolicyForRule(rule: DraftRule): StaffTaskPolicy {
  const row = "workbookRow" in rule ? (rule as LoadedDraftRule).workbookRow : undefined;
  return staffTaskPolicy({
    role: catalogRoleForRow(row),
    parentKey: parentKeyForElement(row),
    createsUserTask: rowString(row, "creates_user_task") || undefined,
    parentAssignment: rule.group.parentAssignment,
    taskType: rowString(row, "task_type"),
  });
}

function predicateLiveKeys(rule: Pick<DraftRule, "catalogKeys" | "predicates">): string[] {
  const keys = [
    ...rule.catalogKeys,
    ...rule.predicates.map((p) => p.catalogKey).filter((k): k is string => !!k),
  ];
  return [...new Set(keys.filter((key) => sowCatalogEntryByKey(key) != null))];
}

function citationSectionsFromText(citation: string): string[] {
  const matches = [...citation.matchAll(/§\s*([0-9]+(?:\.[0-9]+)*(?:\([^)]+\))*)/gi)];
  const first = citationSection(citation);
  const sections = matches.map((m) => normalizeSection(m[1] ?? ""));
  if (first) sections.push(normalizeSection(first));
  return [...new Set(sections.filter((s) => s.length > 0))];
}

function citationLiveMatches(ruleId: string, clauseIds: readonly string[]): SowCatalogEntry[] {
  const want = new Set([ruleId, ...clauseIds].map(normalizeSection).filter((s) => s.length > 0));
  if (want.size === 0) return [];
  return allSowCatalogEntries().filter((entry) => {
    const sections = citationSectionsFromText(entry.citation);
    return sections.some((section) => want.has(section));
  });
}

export function liveObligationKeyForRequirement(
  ruleId: string,
  extras?: {
    catalogKeys?: string[];
    predicateKeys?: Array<string | null | undefined>;
    clauseIds?: string[];
  },
): string | null {
  const explicit = EXPLICIT_REQ_TO_LIVE_KEY[ruleId];
  if (explicit && sowCatalogEntryByKey(explicit)) return explicit;
  const hinted = [...(extras?.catalogKeys ?? []), ...(extras?.predicateKeys ?? [])].filter(
    (k): k is string => !!k && sowCatalogEntryByKey(k) != null,
  );
  if (hinted[0]) return hinted[0];
  const matches = citationLiveMatches(ruleId, extras?.clauseIds ?? []);
  if (matches.length === 1) return matches[0].key;
  return null;
}

export function liveObligationKeyForRule(rule: DraftRule): string | null {
  const row = "workbookRow" in rule ? (rule as LoadedDraftRule).workbookRow : undefined;
  const sectionRef = typeof row?.section_ref === "string" ? row.section_ref : "";
  return liveObligationKeyForRequirement(rule.id, {
    catalogKeys: rule.catalogKeys,
    predicateKeys: rule.predicates.map((p) => p.catalogKey),
    clauseIds: [...rule.source.clauseIds, sectionRef].filter(Boolean),
  });
}

export function liveEntryForRule(rule: DraftRule): SowCatalogEntry | null {
  const key = liveObligationKeyForRule(rule);
  return key ? sowCatalogEntryByKey(key) : null;
}

export function implementationStatusForRule(
  rule: DraftRule,
  blocked: boolean,
): LiveImplementationStatus {
  const policy = staffTaskPolicyForRule(rule);
  if (policy.role === "element") return "element_of_parent";
  if (blocked) return "blocked";
  const live = liveEntryForRule(rule);
  if (live) {
    return live.disposition === "obligation" ? "live_mapped" : "live_artifact";
  }
  if (
    !policy.createsUserTask &&
    rowString((rule as LoadedDraftRule).workbookRow, "handling_label") === "SYSTEM"
  ) {
    return "system_behavior";
  }
  if (!policy.mintsStaffTask && !policy.createsUserTask) return "system_behavior";
  return "draft_unwired";
}

/** Drop child-element cards when a parent (or live key) is already in the queue. */
export function filterDuplicateElementTasks<
  T extends {
    requirementRole?: string;
    parentRequirementKey?: string | null;
  },
>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => task.requirementRole !== "element");
}
