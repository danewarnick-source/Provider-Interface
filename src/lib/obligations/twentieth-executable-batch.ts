/**
 * Twentieth shared-behavior executable batch: MEGA invent-4 —
 * Dane unlocked the remaining 26 draft-unwired leftover parents.
 *
 * Invents fourteen pack liveKeys and the named predicates. Official
 * catalog clause_text only — do not invent SOW. Do not reuse ol_*
 * license-file keys, upi_* Provider Interface keys, residential_group_mix,
 * host_staff_qualifications, milestone_rfs, sec_pass_documentation, or
 * els_school_age. Staff never touch UPI. Punch pad stays the incident
 * clock. EVV stays CSV only. Never delete MAR/eMAR. Publication stays
 * off until VERIFIED_PUBLICATIONS is filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { awardedCodeDutyStatus, type OrgFacts } from "./applicability.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import { PRODUCT_REMINDER_OFFSETS_DAYS } from "./draft-rules/reminders.ts";
import type { CatalogFact, LoadedDraftRule } from "./draft-rules/catalog-loader.ts";
import { canActivate, canPublish } from "./draft-rules/publication.ts";
import { linkWorkbookSource, WORKBOOK_SOURCE_INDEX } from "./draft-rules/source.ts";
import { VERIFIED_PUBLICATIONS } from "./draft-rules/verified-publication.ts";
import type {
  CompletionRoute,
  DraftPredicate,
  DraftRule,
  DraftRuleTest,
  PredicateKind,
  TimingAnchor,
} from "./draft-rules/types.ts";

export const TWENTIETH_EXECUTABLE_BATCH_ID = "unlocked_blocked_leftovers" as const;

export const TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "ol_capacity_comply",
  "upi_employee_registry",
  "upi_employee_timesheet",
  "agency_license_register",
  "els_residential_eligibility",
  "home_condition_checklist",
  "sec_requires_sei",
  "sjp_requires_sjd",
  "sjr_requires_see_or_sei",
  "group_service_review_historical",
  "dlbc_group_variance",
  "medicaid_provider_training_offered",
  "person_record_file",
  "staff_minimum_age",
] as const;

export const TWENTIETH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-7.3.5",
  "REQ-8.3.3",
  "REQ-9.3.5",
  "REQ-22.3.3",
  "REQ-23.3.4",
  "REQ-24.3.3",
  "REQ-25.3.4",
  "REQ-26.3.2",
  "REQ-30.8.1",
  "REQ-30.8.2",
  "REQ-33.7.1",
  "REQ-33.7.2",
  "REQ-1.4.3",
  "REQ-1.34",
  "REQ-10.5",
  "REQ-11.3.2",
  "REQ-20.3.2",
  "REQ-21.3.2",
  "REQ-27.5",
  "REQ-34.5",
  "REQ-35.5",
  "REQ-1.32.a",
  "REQ-1.32.c",
  "REQ-1.13.4",
  "REQ-1.10",
  "REQ-1.5",
] as const;

export const TWENTIETH_BATCH_ADMIN_ONLY_LIVE_KEYS = [
  "upi_employee_registry",
  "upi_employee_timesheet",
] as const;

export const TWENTIETH_BATCH_FALSE_FRIEND_KEYS = [
  "ol_day_tx_license_4plus",
  "ol_day_support_cert_3or_fewer",
  "ol_rhs_license_4plus",
  "upi_form_0_9_designee",
  "upi_form_0_8_user",
  "sei_employment_data_upi",
  "residential_group_mix",
  "host_staff_qualifications",
  "els_school_age",
  "milestone_rfs",
  "sec_pass_documentation",
  "timesheets_attendance",
  "grievance_acknowledgment",
  "dnr_order_access",
] as const;

export type TwentiethExecutableBatchRuleId =
  (typeof TWENTIETH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type TwentiethExecutableBatchLiveKey =
  (typeof TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type TwentiethBatchLiveFactKey =
  | "awarded_dsg_dsp"
  | "awarded_dsi"
  | "awarded_epr"
  | "awarded_rp2"
  | "awarded_rp3"
  | "awarded_rp4"
  | "awarded_rp5"
  | "awarded_rps"
  | "awarded_sei"
  | "awarded_sjd"
  | "awarded_hhs"
  | "awarded_pps"
  | "awarded_rhs"
  | "awarded_els"
  | "awarded_sec"
  | "awarded_sjp"
  | "awarded_sjr"
  | "contractor_standing_file"
  | "eligibility_els_residential"
  | "eligibility_sec_sei"
  | "eligibility_sjp_sjd"
  | "eligibility_sjr_see_sei"
  | "historical_cohort"
  | "event_triggered"
  | "as_offered_event";

export type TwentiethBatchEngineBinding = {
  ruleId: TwentiethExecutableBatchRuleId;
  liveKeys: readonly TwentiethExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment:
    | "awarded_service_leftover"
    | "contractor_file_reeval"
    | "admin_attestation"
    | "eligibility_gate"
    | "event_offered"
    | "system_check";
  evidence: "hybrid_record" | "upload_file" | "admin_attestation" | "system_check";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review" | "upload_review" | "admin_only" | "system_check";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: TwentiethBatchLiveFactKey;
  awardedCodes: readonly string[];
  gateCodes: readonly string[];
  factId: string | null;
  disposition: "standing";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Standing invent-4 leftover file — keep current. Do not invent a calendar interval, hire+N, or annual-from-completion.",
};

const EVENT_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Event leftover — admin-supplied date or trigger. Do not invent a calendar interval.",
};

const COHORT_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Historical Group Service Review cohort — official workbook date stays on the clause, not as an invented calendar interval.",
};

const SYSTEM_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "System-check from staff date of birth. Do not invent a training upload card.",
};

type FamilyMeta = {
  title: string;
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  evidence: TwentiethBatchEngineBinding["evidence"];
  adminReview: TwentiethBatchEngineBinding["adminReview"];
  predicateKind: PredicateKind;
  assignment: TwentiethBatchEngineBinding["assignment"];
};

const ALWAYS_OPEN_KEYS = new Set<TwentiethExecutableBatchLiveKey>([
  "agency_license_register",
  "group_service_review_historical",
  "dlbc_group_variance",
  "medicaid_provider_training_offered",
  "person_record_file",
  "staff_minimum_age",
]);

const ELIGIBILITY_KEYS = new Set<TwentiethExecutableBatchLiveKey>([
  "els_residential_eligibility",
  "sec_requires_sei",
  "sjp_requires_sjd",
  "sjr_requires_see_or_sei",
]);

const FAMILIES: Readonly<Record<TwentiethExecutableBatchLiveKey, FamilyMeta>> = {
  ol_capacity_comply: {
    title: "OL Capacity Comply Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "EXTERNAL"],
    handling:
      "The live OL-capacity comply card is the handling path. Standing comply-card — not a calendar and not a license-file attachment. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  upi_employee_registry: {
    title: "UPI Employee Registry Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "Administrator attests that the UPI employee registry unique identifier is in place. Staff never touch UPI. Never a DSP My Tasks card. Do not reuse Provider Interface or SEI employment-data keys.",
    evidence: "admin_attestation",
    adminReview: "admin_only",
    predicateKind: "awarded_service_codes",
    assignment: "admin_attestation",
  },
  upi_employee_timesheet: {
    title: "UPI Employee Timesheet Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "Administrator attests that pay-period staff timesheets were submitted in UPI. Staff never touch UPI. Never a DSP My Tasks card. Punch pad stays the clock. EVV stays CSV only.",
    evidence: "admin_attestation",
    adminReview: "admin_only",
    predicateKind: "awarded_service_codes",
    assignment: "admin_attestation",
  },
  agency_license_register: {
    title: "Agency License Register Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live agency license register is the handling path. Do not reuse per-article ol_* service keys. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  els_residential_eligibility: {
    title: "ELS Residential Eligibility Leftovers",
    timing: STANDING_NONE,
    routes: ["SYSTEM"],
    handling:
      "Eligibility gate: awarded ELS plus at least one of RHS, PPS, or HHS. Do not attach to els_school_age. Official workbook clause_text stays the member label.",
    evidence: "system_check",
    adminReview: "system_check",
    predicateKind: "eligibility_gate",
    assignment: "eligibility_gate",
  },
  home_condition_checklist: {
    title: "Home Condition Checklist Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "The live home-condition checklist is the handling path. Children (A)–(G) stay on the parent. Do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  sec_requires_sei: {
    title: "SEC Requires SEI Leftovers",
    timing: STANDING_NONE,
    routes: ["SYSTEM"],
    handling:
      "Eligibility gate: awarded SEC plus awarded SEI. Do not attach to milestone_rfs or sec_pass_documentation. Official workbook clause_text stays the member label.",
    evidence: "system_check",
    adminReview: "system_check",
    predicateKind: "eligibility_gate",
    assignment: "eligibility_gate",
  },
  sjp_requires_sjd: {
    title: "SJP Requires SJD Leftovers",
    timing: STANDING_NONE,
    routes: ["SYSTEM"],
    handling:
      "Eligibility gate: awarded SJP plus a current DHHS91172 SJD contract. Do not attach to milestone_rfs. Official workbook clause_text stays the member label.",
    evidence: "system_check",
    adminReview: "system_check",
    predicateKind: "eligibility_gate",
    assignment: "eligibility_gate",
  },
  sjr_requires_see_or_sei: {
    title: "SJR Requires SEE or SEI Leftovers",
    timing: STANDING_NONE,
    routes: ["SYSTEM"],
    handling:
      "Eligibility gate: awarded SJR plus a current DHHS91172 SEE or SEI contract. Do not attach to milestone_rfs. Official workbook clause_text stays the member label.",
    evidence: "system_check",
    adminReview: "system_check",
    predicateKind: "eligibility_gate",
    assignment: "eligibility_gate",
  },
  group_service_review_historical: {
    title: "Historical Group Service Review Leftovers",
    timing: COHORT_NONE,
    routes: ["UPLOAD"],
    handling:
      "Historical Group Service Review leftover file for the existing-contractor cohort. Do not reuse residential_group_mix. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "historical_cohort",
    assignment: "contractor_file_reeval",
  },
  dlbc_group_variance: {
    title: "DLBC Group Variance Leftovers",
    timing: EVENT_NONE,
    routes: ["IN_PLATFORM", "EXTERNAL"],
    handling:
      "DLBC portal variance evidence when group services are delivered at an OL-licensed site. Event-triggered. Do not reuse residential_group_mix. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "event_triggered",
    assignment: "event_offered",
  },
  medicaid_provider_training_offered: {
    title: "As-Offered Medicaid Provider Training Leftovers",
    timing: EVENT_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "As-offered DIH/DSPD Medicaid Provider training leftover. Admin-supplied offered date. Do not invent a calendar interval. Official workbook clause_text stays the member label.",
    evidence: "admin_attestation",
    adminReview: "admin_only",
    predicateKind: "as_offered_event",
    assignment: "event_offered",
  },
  person_record_file: {
    title: "Person Record File Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "The live person-record parent file is the handling path. Already-wired 1.10 children stay on their own cards. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  staff_minimum_age: {
    title: "Staff Minimum Age System Check Leftovers",
    timing: SYSTEM_NONE,
    routes: ["SYSTEM"],
    handling:
      "System-check from staff date of birth. Do not reuse host_staff_qualifications. Do not invent a training upload card. Children stay on the parent. Official workbook clause_text stays the member label.",
    evidence: "system_check",
    adminReview: "system_check",
    predicateKind: "contractor_standing_file",
    assignment: "system_check",
  },
};

const OFFICIAL = {
  "REQ-7.3.5":
    '(5) comply with all licensing and certification rules and requirements when providing services that require a license or certification from the DHHS Office of Licensing ("OL"). Regardless of the services being provided, a site-based facility must not exceed its capacity allowed under the license or certification; and',
  "REQ-8.3.3":
    "(3) comply with all licensing and certification rules and requirements when providing services that require a license or certification from OL. Regardless of the services being provided, a site-based facility must not exceed its capacity allowed under the license or certification.",
  "REQ-9.3.5":
    "(5) comply with all licensing and certification rules and requirements when providing services that require a license or certification from the OL. Regardless of the services being provided, a site-based facility must not exceed its capacity allowed under the license or certification; and",
  "REQ-22.3.3":
    "(3) comply with all licensing and certification rules and requirements when providing services that require a license or certification from OL. Regardless of the services being provided, a site-based facility must not exceed its capacity allowed under the license or certification; and",
  "REQ-23.3.4":
    "(4) comply with all OL licensing and certification rules and requirements when providing services that require an OL license or certification. Regardless of the services being provided, a facility must NOT exceed the capacity allowed under its license or certification; and",
  "REQ-24.3.3":
    "(3) comply with all licensing and certification rules and requirements when providing services that require a license or certification from OL. Regardless of the services being provided, a site-based facility must not exceed its capacity allowed under the license or certification; and",
  "REQ-25.3.4":
    "(4) comply with all OL licensing and certification rules and requirements when providing services that require an OL license or certification. Regardless of the services being provided, a facility must NOT exceed the capacity allowed under its license or certification; and",
  "REQ-26.3.2":
    "(2) comply with all OL licensing and certification rules and requirements when providing services that require an OL license or certification. Regardless of the services being provided, a facility must NOT exceed the capacity allowed under its license or certification; and",
  "REQ-30.8.1":
    "(1) comply with the UPI Employee registry to set up a unique identifier for each Staff that will be stamped on each payment belonging to the Staff;",
  "REQ-30.8.2":
    "(2) submit Staff daily timesheet records for each pay period as individual payments directly into UPI system required data fields; and",
  "REQ-33.7.1":
    "(1) comply with the UPI Employee registry to set up a unique identifier for each Staff that will be stamped on each payment belonging to the Staff;",
  "REQ-33.7.2":
    "(2) submit Staff daily timesheet records for each pay period as individual payments directly into UPI system required data fields; and",
  "REQ-1.4.3":
    "(3) obtain, or maintain current, all licenses and certificates identified in the individual service code descriptions and as outlined in Utah Administrative Code R501 and Utah Code §58-1 et. seq.",
  "REQ-1.34":
    "1.34 Licenses and Certifications. The Contract shall maintain all required licenses and certifications. The Contractor may be required to repay funds to DHHS/DSPD if licenses and certifications are not maintained.",
  "REQ-10.5":
    "10.5 Specific Contractor Qualifications. The Contractor shall have at least one of the following service codes awarded: RHS, PPS, or HHS.",
  "REQ-11.3.2": "(2) ensure the HHS home:",
  "REQ-20.3.2": "(2) ensure the PPS home:",
  "REQ-21.3.2": "(2) ensure the RHS home:",
  "REQ-27.5":
    "27.5 Specific Service Contractor Qualifications. The Contractor shall provide the Person's SEI services.",
  "REQ-34.5":
    "34.5 Specific Contractor Qualification. The Contractor must have a current contract under DHHS91172 for Supported Job Development (SJD).",
  "REQ-35.5":
    "35.5 Specific Contract Qualifications. The Contractor must have a current contract under DHHS91172 for Supported Employment Enterprise (SEE) or Supported Employment for an Individual (SEI).",
  "REQ-1.32.a":
    '(a) Contractors who do not currently meet the Group Services requirements have until February 28, 2026 to submit their "Group Service Review" form.',
  "REQ-1.32.c":
    '(c) For any group services in a site that is licensed through the DHHS Office of Licensing, the Contractor shall request a variance through the Division of Licensing and Background Clearance ("DLBC") provider portal. The Contractor shall obtain approval from the DHHS Office of Licensing prior to delivering these services.',
  "REQ-1.13.4": "(4) participate in DIH and DSPD Medicaid Provider trainings;",
  "REQ-1.10":
    "1.10 Person Records. The Person's records are State and DSPD property. The Contractor shall maintain a separate record for each Person receiving services. The Contractor shall update the Person's record at least annually and upon a material change in the Person's circumstances. In addition to documentation required by this contract, the Person's record must include:",
  "REQ-1.5":
    "1.5 General Contractor and Staff Qualifications. The Contractor's Staff shall be at least 16 years of age unless:",
} as const;

type ChildSpec = {
  id: TwentiethExecutableBatchRuleId;
  liveKey: TwentiethExecutableBatchLiveKey;
  section: string;
  codes: readonly string[];
  gateCodes: readonly string[];
  factId: string | null;
  question: string | null;
  liveFactKey: TwentiethBatchLiveFactKey;
};

const SPECS: readonly ChildSpec[] = [
  {
    id: "REQ-7.3.5",
    liveKey: "ol_capacity_comply",
    section: "7.3(5)",
    codes: ["DSG", "DSP"],
    gateCodes: [],
    factId: "FACT-015",
    question: "Agency awarded DSG,DSP?",
    liveFactKey: "awarded_dsg_dsp",
  },
  {
    id: "REQ-8.3.3",
    liveKey: "ol_capacity_comply",
    section: "8.3(3)",
    codes: ["DSI"],
    gateCodes: [],
    factId: "FACT-019",
    question: "Agency awarded DSI?",
    liveFactKey: "awarded_dsi",
  },
  {
    id: "REQ-9.3.5",
    liveKey: "ol_capacity_comply",
    section: "9.3(5)",
    codes: ["EPR"],
    gateCodes: [],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-22.3.3",
    liveKey: "ol_capacity_comply",
    section: "22.3(3)",
    codes: ["RP2"],
    gateCodes: [],
    factId: "FACT-038",
    question: "Agency awarded RP2?",
    liveFactKey: "awarded_rp2",
  },
  {
    id: "REQ-23.3.4",
    liveKey: "ol_capacity_comply",
    section: "23.3(4)",
    codes: ["RP3"],
    gateCodes: [],
    factId: "FACT-032",
    question: "Agency awarded RP3?",
    liveFactKey: "awarded_rp3",
  },
  {
    id: "REQ-24.3.3",
    liveKey: "ol_capacity_comply",
    section: "24.3(3)",
    codes: ["RP4"],
    gateCodes: [],
    factId: "FACT-033",
    question: "Agency awarded RP4?",
    liveFactKey: "awarded_rp4",
  },
  {
    id: "REQ-25.3.4",
    liveKey: "ol_capacity_comply",
    section: "25.3(4)",
    codes: ["RP5"],
    gateCodes: [],
    factId: "FACT-028",
    question: "Agency awarded RP5?",
    liveFactKey: "awarded_rp5",
  },
  {
    id: "REQ-26.3.2",
    liveKey: "ol_capacity_comply",
    section: "26.3(2)",
    codes: ["RPS"],
    gateCodes: [],
    factId: "FACT-029",
    question: "Agency awarded RPS?",
    liveFactKey: "awarded_rps",
  },
  {
    id: "REQ-30.8.1",
    liveKey: "upi_employee_registry",
    section: "30.8(1)",
    codes: ["SEI"],
    gateCodes: [],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    liveFactKey: "awarded_sei",
  },
  {
    id: "REQ-30.8.2",
    liveKey: "upi_employee_timesheet",
    section: "30.8(2)",
    codes: ["SEI"],
    gateCodes: [],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    liveFactKey: "awarded_sei",
  },
  {
    id: "REQ-33.7.1",
    liveKey: "upi_employee_registry",
    section: "33.7(1)",
    codes: ["SJD"],
    gateCodes: [],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.7.2",
    liveKey: "upi_employee_timesheet",
    section: "33.7(2)",
    codes: ["SJD"],
    gateCodes: [],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-1.4.3",
    liveKey: "agency_license_register",
    section: "1.4(3)",
    codes: [],
    gateCodes: [],
    factId: "FACT-006",
    question: "Which OL licenses/certifications does the agency hold, per location?",
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.34",
    liveKey: "agency_license_register",
    section: "1.34",
    codes: [],
    gateCodes: [],
    factId: "FACT-006",
    question: "Which OL licenses/certifications does the agency hold, per location?",
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-10.5",
    liveKey: "els_residential_eligibility",
    section: "10.5",
    codes: ["ELS"],
    gateCodes: ["RHS", "PPS", "HHS"],
    factId: "FACT-026",
    question: "Agency awarded ELS?",
    liveFactKey: "eligibility_els_residential",
  },
  {
    id: "REQ-11.3.2",
    liveKey: "home_condition_checklist",
    section: "11.3(2)",
    codes: ["HHS"],
    gateCodes: [],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    liveFactKey: "awarded_hhs",
  },
  {
    id: "REQ-20.3.2",
    liveKey: "home_condition_checklist",
    section: "20.3(2)",
    codes: ["PPS"],
    gateCodes: [],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-21.3.2",
    liveKey: "home_condition_checklist",
    section: "21.3(2)",
    codes: ["RHS"],
    gateCodes: [],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-27.5",
    liveKey: "sec_requires_sei",
    section: "27.5",
    codes: ["SEC"],
    gateCodes: ["SEI"],
    factId: "FACT-039",
    question: "Agency awarded SEC?",
    liveFactKey: "eligibility_sec_sei",
  },
  {
    id: "REQ-34.5",
    liveKey: "sjp_requires_sjd",
    section: "34.5",
    codes: ["SJP"],
    gateCodes: ["SJD"],
    factId: "FACT-049",
    question: "Agency awarded SJP?",
    liveFactKey: "eligibility_sjp_sjd",
  },
  {
    id: "REQ-35.5",
    liveKey: "sjr_requires_see_or_sei",
    section: "35.5",
    codes: ["SJR"],
    gateCodes: ["SEE", "SEI"],
    factId: "FACT-050",
    question: "Agency awarded SJR?",
    liveFactKey: "eligibility_sjr_see_sei",
  },
  {
    id: "REQ-1.32.a",
    liveKey: "group_service_review_historical",
    section: "1.32(a)",
    codes: [],
    gateCodes: [],
    factId: null,
    question: null,
    liveFactKey: "historical_cohort",
  },
  {
    id: "REQ-1.32.c",
    liveKey: "dlbc_group_variance",
    section: "1.32(c)",
    codes: [],
    gateCodes: [],
    factId: "FACT-006",
    question: "Which OL licenses/certifications does the agency hold, per location?",
    liveFactKey: "event_triggered",
  },
  {
    id: "REQ-1.13.4",
    liveKey: "medicaid_provider_training_offered",
    section: "1.13(4)",
    codes: [],
    gateCodes: [],
    factId: null,
    question: null,
    liveFactKey: "as_offered_event",
  },
  {
    id: "REQ-1.10",
    liveKey: "person_record_file",
    section: "1.10",
    codes: [],
    gateCodes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.5",
    liveKey: "staff_minimum_age",
    section: "1.5",
    codes: [],
    gateCodes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
];

function tests(prefix: string, liveKey: TwentiethExecutableBatchLiveKey): DraftRuleTest[] {
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `The live ${liveKey} parent file plus the applicability predicate greens this leftover parent on that card.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A generic attestation without the live parent file leaves the leftover incomplete. A known-false applicability fact does not open this clock.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "Leftover children stay on the invented parent card. Official catalog clause_text only. Do not reuse ol_* license-file keys, upi_* Provider Interface keys, residential_group_mix, host_staff_qualifications, milestone_rfs, sec_pass_documentation, or els_school_age. Never delete MAR/eMAR. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only.",
    },
  ];
}

function predicatesFor(spec: ChildSpec): DraftPredicate[] {
  const family = FAMILIES[spec.liveKey];
  if (family.predicateKind === "awarded_service_codes") {
    return [
      {
        kind: "awarded_service_codes",
        catalogKey: spec.liveKey,
        serviceCodes: spec.codes,
      },
    ];
  }
  if (family.predicateKind === "eligibility_gate") {
    const rows: DraftPredicate[] = [
      {
        kind: "eligibility_gate",
        catalogKey: spec.liveKey,
        serviceCodes: spec.codes,
      },
    ];
    if (spec.gateCodes.length > 0) {
      rows.push({
        kind: "eligibility_gate",
        catalogKey: spec.liveKey,
        serviceCodes: spec.gateCodes,
      });
    }
    return rows;
  }
  if (family.predicateKind === "as_offered_event") {
    return [{ kind: "as_offered_event", catalogKey: spec.liveKey }];
  }
  if (family.predicateKind === "historical_cohort") {
    return [{ kind: "historical_cohort", catalogKey: spec.liveKey }];
  }
  if (family.predicateKind === "event_triggered") {
    return [{ kind: "event_triggered", catalogKey: spec.liveKey }];
  }
  return [{ kind: "contractor_standing_file", catalogKey: spec.liveKey }];
}

function fileRule(spec: ChildSpec): DraftRule {
  const family = FAMILIES[spec.liveKey];
  const official = OFFICIAL[spec.id];
  const clause = `SOW §${spec.section}`;
  return {
    id: spec.id,
    version: 1,
    title: family.title,
    catalogKeys: [spec.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource([clause]),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: predicatesFor(spec),
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${spec.id}-file`,
          label: official,
          sourceClauseId: clause,
          catalogKey: spec.liveKey,
          completionRoutes: family.routes,
        },
      ],
    },
    timing: family.timing,
    evidence: {
      summary: official,
      routes: family.routes,
      defaultHandlingLabel: family.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: family.routes,
    tests: tests(spec.id, spec.liveKey),
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    releaseGaps: [],
    publicationGap: null,
    approval: null,
  };
}

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = Object.fromEntries(
  SPECS.map((spec) => [spec.id, fileRule(spec)]),
);

export const TWENTIETH_BATCH_ENGINE_BINDINGS: readonly TwentiethBatchEngineBinding[] =
  SPECS.map((spec) => {
    const family = FAMILIES[spec.liveKey];
    const siblingIds = SPECS.filter((row) => row.liveKey === spec.liveKey && row.id !== spec.id).map(
      (row) => row.id,
    );
    return {
      ruleId: spec.id,
      liveKeys: [spec.liveKey],
      parentAssignment: "one",
      mintsElementTasks: false,
      assignment: family.assignment,
      evidence: family.evidence,
      trainingTitle: null,
      formTitle: null,
      reminders: "product_default",
      adminReview: family.adminReview,
      blocksSoloWhenLapsed: false,
      liveFactKey: spec.liveFactKey,
      awardedCodes: spec.codes,
      gateCodes: spec.gateCodes,
      factId: spec.factId,
      disposition: "standing",
      sharesLiveKeyWith: siblingIds,
    };
  });

export const TWENTIETH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse awarded-code and eligibility-gate facts; standing leftovers stay standing",
    detail:
      "Awarded leftovers open on the matching service code. Eligibility gates need both code groups. Registry, license, person-record, cohort, and as-offered leftovers open as standing or event files. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per invented leftover live key",
    detail:
      "Twenty-six leftover parents collapse onto fourteen invented liveKeys. Child items stay on the parent. UPI leftovers are Administrator-only and never DSP My Tasks.",
  },
  {
    step: "evidence",
    title: "Map official catalog clause_text — no invented SOW",
    detail:
      "Official workbook clause_text is the member label. Upload, system-check, or the live leftover record is the handling path. Do not delete MAR/eMAR. Staff never touch UPI. EVV stays CSV only.",
  },
  {
    step: "review",
    title: "Admin accepts on the upload/record review",
    detail:
      "Submitted files sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the standing keep-current rule only",
    detail:
      "Standing leftover files stay keep-current. Event leftovers wait for the admin-supplied or trigger date. Do not invent hire+N, annual-from-completion, or a calendar interval.",
  },
] as const;

export function isTwentiethExecutableBatchRuleId(ruleId: string): boolean {
  return (TWENTIETH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isTwentiethExecutableBatchLiveKey(key: string): boolean {
  return (TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function twentiethBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function twentiethBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec?.factId || !spec.question) return [];
  return [{ fact_id: spec.factId, question: spec.question }];
}

function mergeCatalogFacts(
  existing: CatalogFact[] | undefined,
  added: CatalogFact[],
): CatalogFact[] {
  const seen = new Set<string>();
  const out: CatalogFact[] = [];
  for (const fact of [...(existing ?? []), ...added]) {
    if (!fact.fact_id || seen.has(fact.fact_id)) continue;
    seen.add(fact.fact_id);
    out.push(fact);
  }
  return out;
}

export function applyTwentiethExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = twentiethBatchFixtureFor(rule.id);
  if (!fixture || !isTwentiethExecutableBatchRuleId(rule.id)) return rule;
  const existingFacts =
    "applicabilityFacts" in rule ? (rule as LoadedDraftRule).applicabilityFacts : undefined;
  return {
    ...rule,
    catalogKeys: fixture.catalogKeys,
    predicates: fixture.predicates,
    group: fixture.group,
    timing: fixture.timing,
    evidence: fixture.evidence,
    completionRoutes: fixture.completionRoutes,
    tests: fixture.tests,
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    ...(existingFacts
      ? {
          applicabilityFacts: mergeCatalogFacts(
            existingFacts,
            twentiethBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyTwentiethExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyTwentiethExecutableBatchOverlay(rule));
}

export function twentiethExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isTwentiethExecutableBatchRuleId(rule.id))
    .map((rule) => applyTwentiethExecutableBatchOverlay(rule));
}

export function twentiethBatchBindingForRule(
  ruleId: string,
): TwentiethBatchEngineBinding | null {
  return TWENTIETH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function twentiethBatchLiveEngineReady(row: TwentiethBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of row.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== row.disposition) {
      reasons.push(`${key} is ${entry.disposition}, expected ${row.disposition}.`);
    }
  }
  if (row.parentAssignment !== "one") {
    reasons.push("Parent assignment must stay one — no per-element staff tasks.");
  }
  if (row.mintsElementTasks) {
    reasons.push("Child elements must not mint staff tasks.");
  }
  if (row.trainingTitle !== null) {
    reasons.push("This batch does not invent an in-PI course.");
  }
  if (row.formTitle !== null) {
    reasons.push("This batch does not invent a person form.");
  }
  if (row.reminders !== "product_default") {
    reasons.push("Reminders must reuse product-default offsets, not invented SOW intervals.");
  }
  if (PRODUCT_REMINDER_OFFSETS_DAYS.length === 0) {
    reasons.push("Product reminder offsets are missing.");
  }
  if (row.blocksSoloWhenLapsed !== isBlocksSoloWhenLapsedKey(row.liveKeys[0])) {
    reasons.push(`Solo-lapse wiring mismatch for ${row.liveKeys[0]}.`);
  }
  if (row.liveKeys.length !== 1 || !isTwentiethExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on the fourteen invented leftover liveKeys.");
  }
  const liveKey = row.liveKeys[0];
  if (liveKey && (TWENTIETH_BATCH_FALSE_FRIEND_KEYS as readonly string[]).includes(liveKey)) {
    reasons.push(`${liveKey} is a false-friend key.`);
  }
  if (
    liveKey &&
    (TWENTIETH_BATCH_ADMIN_ONLY_LIVE_KEYS as readonly string[]).includes(liveKey)
  ) {
    const entry = sowCatalogEntryByKey(liveKey);
    if (entry?.owner !== "admin") {
      reasons.push(`${liveKey} must stay Administrator-owned so staff never touch UPI.`);
    }
  }
  return { ready: reasons.length === 0, reasons };
}

export function twentiethBatchAssignmentOpensClock(
  liveKey: TwentiethExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
  gateCodes?: readonly string[],
): boolean {
  if (ALWAYS_OPEN_KEYS.has(liveKey)) return true;
  const offered = orgFacts?.servicesOffered ?? [];
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  const primary = awardedCodeDutyStatus([...codes], offered);
  if (ELIGIBILITY_KEYS.has(liveKey)) {
    const gate = gateCodes ?? [];
    if (gate.length === 0) return primary === "applies";
    return primary === "applies" && awardedCodeDutyStatus([...gate], offered) === "applies";
  }
  return primary === "applies";
}

export function twentiethBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function twentiethBatchParentIsWired(rule: DraftRule): boolean {
  if (!isTwentiethExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyTwentiethExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isTwentiethExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function twentiethBatchSharedLiveKeyParents(liveKey: string): string[] {
  return TWENTIETH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as TwentiethExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function twentiethBatchExpectedLiveKey(
  ruleId: TwentiethExecutableBatchRuleId,
): TwentiethExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown twentieth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function twentiethBatchOfficialClause(ruleId: TwentiethExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function twentiethBatchOmitsFalseFriends(): boolean {
  const keys = TWENTIETH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = TWENTIETH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("ol_capacity_comply") &&
    keys.includes("upi_employee_registry") &&
    keys.includes("upi_employee_timesheet") &&
    keys.includes("agency_license_register") &&
    keys.includes("els_residential_eligibility") &&
    keys.includes("home_condition_checklist") &&
    keys.includes("sec_requires_sei") &&
    keys.includes("sjp_requires_sjd") &&
    keys.includes("sjr_requires_see_or_sei") &&
    keys.includes("group_service_review_historical") &&
    keys.includes("dlbc_group_variance") &&
    keys.includes("medicaid_provider_training_offered") &&
    keys.includes("person_record_file") &&
    keys.includes("staff_minimum_age") &&
    !keys.includes("residential_group_mix") &&
    !keys.includes("host_staff_qualifications") &&
    !keys.includes("els_school_age") &&
    !keys.includes("milestone_rfs") &&
    !keys.includes("sec_pass_documentation") &&
    !keys.includes("ol_rhs_license_4plus") &&
    !keys.includes("sei_employment_data_upi") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-20.3") &&
    !rules.includes("REQ-21.3") &&
    rules.includes("REQ-7.3.5") &&
    rules.includes("REQ-1.5") &&
    rules.length === 26
  );
}
