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
  "REQ-1.15.1": "upi_form_0_9_designee",
  "REQ-1.15.2": "upi_form_0_8_user",
  "REQ-1.15.3": "upi_need_to_know_access",
  "REQ-1.15.4": "upi_1056_decision",
  "REQ-1.15.5": "upi_1056_reject_coordinate",
  "REQ-1.15.6": "upi_1056_utilization",
  "REQ-1.15.7": "upi_provider_organization",
  "REQ-1.15.8": "upi_staff_org_groups",
  "REQ-1.15.9": "upi_staff_notify_prefs",
  "REQ-1.15.10": "upi_person_org_groups",
  "REQ-1.15.11": "upi_remove_terminated_staff",
  "REQ-1.15.12": "upi_remove_staff_need_to_know",
  "REQ-1.15.13": "upi_remove_discharged_person",
  "REQ-1.15.14": "upi_annual_access_review",
  "REQ-1.15.15": "upi_notify_usteps_termination",
  "REQ-3.3.1": "fba_bsp",
  "REQ-3.3.2": "fba_bsp",
  "REQ-3.3.3": "fba_bsp",
  "REQ-3.3.4": "fba_bsp",
  "REQ-3.3.5": "fba_bsp",
  "REQ-3.3.6": "fba_bsp",
  "REQ-3.3.7": "fba_bsp",
  "REQ-3.3.8": "fba_bsp",
  "REQ-3.4.1": "fba_bsp",
  "REQ-3.4.2": "fba_bsp",
  "REQ-3.4.4": "fba_bsp",
  "REQ-3.4.5": "fba_bsp",
  "REQ-3.4.6": "fba_bsp",
  "REQ-3.4.7": "fba_bsp",
  "REQ-4.3.1": "fba_bsp",
  "REQ-4.3.2": "fba_bsp",
  "REQ-4.3.3": "fba_bsp",
  "REQ-4.3.4": "fba_bsp",
  "REQ-4.3.5": "fba_bsp",
  "REQ-4.3.6": "fba_bsp",
  "REQ-4.3.7": "fba_bsp",
  "REQ-4.4.1": "fba_bsp",
  "REQ-4.4.2": "fba_bsp",
  "REQ-4.4.4": "fba_bsp",
  "REQ-4.4.5": "fba_bsp",
  "REQ-4.4.6": "fba_bsp",
  "REQ-4.4.7": "fba_bsp",
  "REQ-5.3.1": "fba_bsp",
  "REQ-5.3.2": "fba_bsp",
  "REQ-5.3.3": "fba_bsp",
  "REQ-5.3.4": "fba_bsp",
  "REQ-5.3.5": "fba_bsp",
  "REQ-5.3.6": "fba_bsp",
  "REQ-5.3.7": "fba_bsp",
  "REQ-5.3.8": "fba_bsp",
  "REQ-5.4.1": "fba_bsp",
  "REQ-5.4.2": "fba_bsp",
  "REQ-5.4.4": "fba_bsp",
  "REQ-5.4.5": "fba_bsp",
  "REQ-5.4.6": "fba_bsp",
  "REQ-5.4.7": "fba_bsp",
  "REQ-1.6": "volunteer_training_file",
  "REQ-1.6.1": "volunteer_training_file",
  "REQ-1.6.2.B": "volunteer_training_file",
  "REQ-1.6.3": "volunteer_training_file",
  "REQ-1.6.3.B": "volunteer_training_file",
  "REQ-1.6.3.F": "volunteer_training_file",
  "REQ-1.7.1": "medicaid_101_contractor",
  "REQ-1.7.2": "medicaid_manuals_memo",
  "REQ-1.7.3": "medicaid_manuals_memo",
  "REQ-1.7.4": "medicaid_manuals_memo",
  "REQ-1.8.4": "orientation_30_day",
  "REQ-1.8.5": "cpr_first_aid_initial",
  "REQ-1.8.5-cpr-current": "cpr_first_aid_renewal",
  "REQ-1.8.6": "behavior_intervention_cert",
  "REQ-1.8.7": "ce_12h_annual",
  "REQ-1.9": "ce_12h_annual",
  "REQ-1.10.11": "grievance_acknowledgment",
  "REQ-1.24.5": "support_strategies",
  "REQ-1.8.8": "abi_training",
  "REQ-1.9.2": "background_screening_annual",
  "REQ-1.9.3": "training_file_maintained",
  "REQ-1.9.4": "educational_credentials",
  "REQ-1.9.6": "medicaid_disclosure_annual",
  "REQ-1.9.7": "medicaid_exclusion_annual",
  "REQ-1.11": "zoning_life_safety",
  "REQ-1.10.7": "timesheets_attendance",
  "REQ-1.12": "evv_visit_verification",
  "REQ-1.13.1": "medicaid_change_notifications",
  "REQ-1.13.3": "medicaid_change_notifications",
  "REQ-1.13.5": "medicaid_disclosure_annual",
  "REQ-1.14": "governing_board_records",
  "REQ-1.14.1": "governing_board_records",
  "REQ-1.14.2": "governing_board_records",
  "REQ-1.14.3": "governing_board_records",
  "REQ-1.14.4": "governing_board_records",
  "REQ-1.17": "personnel_policies",
  "REQ-1.17.a": "personnel_policies",
  "REQ-1.17.b": "personnel_policies",
  "REQ-1.18": "operating_policies",
  "REQ-1.18.2": "operating_policies",
  "REQ-1.18.5": "operating_policies",
  "REQ-1.18.7": "operating_policies",
  "REQ-1.21": "human_rights_plan",
  "REQ-1.21.5": "hrc_committee",
  "REQ-1.22": "person_discharge_process",
  "REQ-1.22.a": "person_discharge_process",
  "REQ-1.22.a.6": "person_discharge_process",
  "REQ-1.22.b.3": "person_discharge_process",
  "REQ-1.22.b.4": "person_discharge_process",
  "REQ-1.22.c": "person_discharge_process",
  "REQ-1.22.c.1": "person_discharge_process",
  "REQ-1.22.c.2": "person_discharge_process",
  "REQ-1.22.c.3": "person_discharge_process",
  "REQ-1.22.d": "person_discharge_process",
  "REQ-1.23": "health_support_policies",
  "REQ-1.23.a": "health_support_policies",
  "REQ-1.23.b": "medication_record",
  "REQ-1.23.c": "medication_record",
  "REQ-1.23.d": "medication_record",
  "REQ-1.23.d.2": "medication_record",
  "REQ-1.23.e": "health_support_policies",
  "REQ-1.23.f.1": "health_support_policies",
  "REQ-1.23.g.1": "health_support_policies",
  "REQ-1.23.h": "medical_dental_exams",
  "REQ-1.28.7": "emergency_loan_record",
  "REQ-1.28.7.A": "emergency_loan_record",
  "REQ-1.28.7.B": "emergency_loan_record",
  "REQ-1.28.7.C": "emergency_loan_record",
  "REQ-1.28.7.D": "emergency_loan_record",
  "REQ-1.28.7.G": "large_loan_disclosure_process",
  "REQ-1.28.7.H": "emergency_loan_record",
  "REQ-1.28.7.I": "emergency_loan_record",
  "REQ-1.28.9": "no_gifts_process",
  "REQ-1.20.a": "hrc_committee",
  "REQ-1.20.b": "rights_restriction_record",
  "REQ-1.20.b.6": "rights_restriction_record",
  "REQ-1.27": "incident_reporting_process",
  "REQ-1.27.1": "incident_reporting_process",
  "REQ-1.27.1.A": "incident_reporting_process",
  "REQ-1.27.1.B": "incident_reporting_process",
  "REQ-1.27.2": "incident_reporting_process",
  "REQ-1.27.3": "incident_reporting_process",
  "REQ-1.27.4": "incident_reporting_process",
  "REQ-1.27.5": "incident_reporting_process",
  "REQ-1.27.6": "incident_reporting_process",
  "REQ-1.28.6": "rights_restriction_record",
  "REQ-1.33.2": "rights_restriction_record",
  "REQ-1.30": "driving_record_transport",
  "REQ-1.30.2": "driving_record_transport",
  "REQ-1.30.3": "driving_record_transport",
  "REQ-1.30.3.G": "driving_record_transport",
  "REQ-28.4": "acre_sed",
  "REQ-1.35": "housemate_informed_choice",
  "REQ-3.7.c": "hhs_annual_outcome",
  "REQ-4.7.c": "hhs_annual_outcome",
  "REQ-5.7.c": "hhs_annual_outcome",
  "REQ-6.5.c": "hhs_annual_outcome",
  "REQ-7.7.c": "hhs_annual_outcome",
  "REQ-8.6": "dsi_annual_outcome",
  "REQ-8.6.c": "dsi_annual_outcome",
  "REQ-9.7.c": "hhs_annual_outcome",
  "REQ-10.6.c": "hhs_annual_outcome",
  "REQ-11.3.5": "belongings_inventory",
  "REQ-11.3.6": "hhs_evac_drills_quarterly",
  "REQ-11.3.9": "hhs_room_board_agreement",
  "REQ-11.5": "hhs_home_cert_annual",
  "REQ-11.7": "hhs_annual_outcome",
  "REQ-11.7.c": "hhs_annual_outcome",
  "REQ-12.5.c": "hhs_annual_outcome",
  "REQ-13.5.c": "hhs_annual_outcome",
  "REQ-14.4.c": "hhs_annual_outcome",
  "REQ-15.5.c": "hhs_annual_outcome",
  "REQ-16.5.c": "hhs_annual_outcome",
  "REQ-17.5.c": "hhs_annual_outcome",
  "REQ-18.6.c": "hhs_annual_outcome",
  "REQ-19.6.c": "hhs_annual_outcome",
  "REQ-20.7.c": "hhs_annual_outcome",
  "REQ-21.6.c": "hhs_annual_outcome",
  "REQ-22.5.c": "hhs_annual_outcome",
  "REQ-23.5.c": "hhs_annual_outcome",
  "REQ-24.5.c": "hhs_annual_outcome",
  "REQ-25.5.c": "hhs_annual_outcome",
  "REQ-26.5.c": "hhs_annual_outcome",
  "REQ-27.6.c": "hhs_annual_outcome",
  "REQ-28.5.c": "hhs_annual_outcome",
  "REQ-29.5.c": "hhs_annual_outcome",
  "REQ-1.28.5": "pba_financial_review",
  "REQ-12.4": "hsq_safe_environment",
  "REQ-15.3": "pba_financial_review",
  "REQ-15.3.1": "pba_financial_review",
  "REQ-15.3.6": "pba_financial_review",
  "REQ-15.3.7": "pba_financial_review",
  "REQ-15.3.8": "pba_financial_review",
  "REQ-15.3.9": "pba_financial_review",
  "REQ-15.3.10": "pba_financial_review",
  "REQ-20.3.5": "belongings_inventory",
  "REQ-20.3.6": "pps_evac_drills_quarterly",
  "REQ-20.3.9": "pps_room_board_agreement",
  "REQ-20.5": "pps_foster_license",
  "REQ-20.5.1": "pps_foster_license",
  "REQ-20.5.2": "pps_foster_license",
  "REQ-21.3.7": "belongings_inventory",
  "REQ-31.3.3": "belongings_inventory",
  "REQ-33.5.a": "usor_job_development_sjd",
  "REQ-21.3.1": "rhs_lease_agreement",
  "REQ-21.3.6": "rhs_evac_drills_quarterly",
  "REQ-7.5.a": "ol_day_tx_license_4plus",
  "REQ-7.5.b": "ol_day_support_cert_3or_fewer",
  "REQ-8.5.a": "ol_day_tx_license_4plus",
  "REQ-8.5.b": "ol_day_support_cert_3or_fewer",
  "REQ-9.6.a": "ol_day_tx_license_4plus",
  "REQ-21.5": "ol_rhs_license_4plus",
  "REQ-30.3": "sei_monthly_summary_upi",
  "REQ-30.3.4": "sei_monthly_summary_upi",
  "REQ-30.3.5": "sei_employment_data_upi",
  "REQ-30.3.6": "sei_employment_strategies_upi",
  "REQ-30.5": "sei_ssi_benefits",
  "REQ-30.6.a": "usor_job_coaching_sei",
  "REQ-30.6.b": "acre_sei",
  "REQ-30.6.c": "acre_sei",
  "REQ-30.7": "sei_annual_outcome",
  "REQ-30.7.c": "sei_annual_outcome",
  "REQ-31.5.c": "sl_annual_outcome",
  "REQ-32.7.c": "sl_annual_outcome",
  "REQ-33.6.c": "hhs_annual_outcome",
  "REQ-34.6.c": "hhs_annual_outcome",
  "REQ-35.6.c": "hhs_annual_outcome",
  "REQ-36.5.c": "hhs_annual_outcome",
  "REQ-32.3": "cmp_cms_monthly_summaries",
  "REQ-32.3.2": "cmp_cms_monthly_summaries",
  "REQ-32.5": "cmp_cms_caregiver_comp",
  "REQ-33.3": "sjd_monthly_summary_upi",
  "REQ-33.3.1": "sjd_usor_contact_monthly",
  "REQ-33.3.4": "sjd_monthly_summary_upi",
  "REQ-33.3.4.I": "sjd_usor_contact_monthly",
  "REQ-33.3.5": "sei_employment_strategies_upi",
  "REQ-33.3.7": "sjd_employment_data_upi",
  "REQ-33.5": "acre_sjd",
  "REQ-33.5.b": "acre_sjd",
  "REQ-33.5.b-c": "acre_sjd",
  "REQ-33.5.c": "customized_employment_usu",
  "REQ-16.2.3": "pm_nursing_file",
  "REQ-16.2.7": "pm_nursing_file",
  "REQ-16.2.8": "pm_nursing_file",
  "REQ-16.2.9": "pm_nursing_file",
  "REQ-16.4": "pm_nursing_file",
  "REQ-17.2.3": "pm_nursing_file",
  "REQ-17.2.7": "pm_nursing_file",
  "REQ-17.2.8": "pm_nursing_file",
  "REQ-17.2.9": "pm_nursing_file",
  "REQ-17.4": "pm_nursing_file",
  "REQ-18.2.3": "pn_medical_care_plan",
  "REQ-18.5": "pn_medical_care_plan",
  "REQ-19.2.7": "pn_medical_care_plan",
  "REQ-19.2.8": "pn_medical_care_plan",
  "REQ-19.2.8.A": "pn_medical_care_plan",
  "REQ-19.2.8.B": "pn_medical_care_plan",
  "REQ-19.2.9.A": "pn_medical_care_plan",
  "REQ-19.2.9.B": "pn_medical_care_plan",
  "REQ-19.2.10": "pn_medical_care_plan",
  "REQ-19.5.a": "pn_medical_care_plan",
  "REQ-19.5.b": "pn_medical_care_plan",
  "REQ-33.2.a": "sjd_discovery_vocational",
  "REQ-33.2.b": "sjd_discovery_vocational",
  "REQ-33.2.c": "sjd_discovery_vocational",
  "REQ-33.2.d": "sjd_discovery_vocational",
  "REQ-33.2.e": "sjd_discovery_vocational",
  "REQ-33.2.i": "sjd_discovery_vocational",
  "REQ-33.2.j": "sjd_discovery_vocational",
  "REQ-33.2.m": "sjd_discovery_vocational",
  "REQ-11.3.1": "household_12plus_background",
  "REQ-20.3.1": "household_12plus_background",
  "REQ-22.3.2": "household_12plus_background",
  "REQ-23.3.3": "household_12plus_background",
  "REQ-24.3.2": "household_12plus_background",
  "REQ-25.3.3": "household_12plus_background",
  "REQ-11.2.7": "medicaid_eligibility_assist",
  "REQ-20.2.7": "medicaid_eligibility_assist",
  "REQ-21.2.6": "medicaid_eligibility_assist",
  "REQ-31.2.3": "medicaid_eligibility_assist",
  "REQ-1.19": "dhhs_quality_remediation",
  "REQ-1.19.1": "dhhs_quality_remediation",
  "REQ-1.19.2": "dhhs_quality_remediation",
  "REQ-1.19.3": "dhhs_quality_remediation",
  "REQ-7.3.4": "program_day_to_day_staff",
  "REQ-9.3.4": "program_day_to_day_staff",
  "REQ-10.3.1": "program_day_to_day_staff",
  "REQ-21.3.5": "program_day_to_day_staff",
  "REQ-28.2.3": "employment_assessment_fade",
  "REQ-28.2.6": "employment_assessment_fade",
  "REQ-29.2.a": "employment_assessment_fade",
  "REQ-30.2.7": "employment_assessment_fade",
  "REQ-34.3": "milestone_rfs",
  "REQ-35.3": "milestone_rfs",
  "REQ-9.2.2": "epr_program_file",
  "REQ-9.2.8": "epr_program_file",
  "REQ-9.5.1": "epr_program_file",
  "REQ-9.5.2": "epr_program_file",
  "REQ-3.6": "bc_staff_qualifications",
  "REQ-4.6": "bc_staff_qualifications",
  "REQ-5.6": "bc_staff_qualifications",
  "REQ-21.3.8": "rhs_housing_voucher",
  "REQ-21.3.8.A": "rhs_housing_voucher",
  "REQ-21.3.8.B": "rhs_housing_voucher",
  "REQ-21.3.8.C": "rhs_housing_voucher",
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

/** One My tasks card per live company_obligations key. Shared parents stay on that card. */
export function collapseParentTasksByLiveKey<
  T extends {
    liveKey?: string | null;
    requirementRole?: string;
  },
>(tasks: readonly T[]): T[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (task.requirementRole === "element") return false;
    const key = task.liveKey;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
