/**
 * Nineteenth shared-behavior executable batch: MEGA invent-3 —
 * remaining inventable leftover families after invent-1 / invent-2.
 *
 * Invents sixteen pack liveKeys and awarded-code / contractor-standing
 * predicates. Official catalog clause_text only — do not invent SOW.
 * Ceiling after #368 was 25 inventable imported parents — every remaining
 * inventable row is in this batch. Vague-comply OL, UPI staff registry,
 * license umbrellas, grandfather, home-condition umbrellas, CST-only,
 * contractor-qualification umbrellas, as-offered trainings, and the
 * person-records umbrella stay invent-blocked.
 * Punch pad stays the incident clock. Staff never touch UPI. EVV stays
 * CSV only. Never delete MAR/eMAR. Publication stays off until
 * VERIFIED_PUBLICATIONS is filled deliberately.
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

export const NINETEENTH_EXECUTABLE_BATCH_ID = "remaining_inventable_leftovers" as const;

export const NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "dnr_order_access",
  "pcsp_person_review",
  "fatality_notification",
  "sc_records_on_request",
  "residential_group_mix",
  "usdc_transition",
  "els_school_age",
  "host_contractor_change",
  "host_staff_qualifications",
  "pba_monthly_fiduciary",
  "rhs_form_930",
  "form_929_exceptional_care",
  "sec_pass_documentation",
  "see_staff_training",
  "sei_job_termination",
  "tfb_staff_qualifications",
] as const;

export const NINETEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.10.14",
  "REQ-1.24.7",
  "REQ-1.24.9",
  "REQ-1.26",
  "REQ-1.31.2",
  "REQ-1.31.3",
  "REQ-1.32.b",
  "REQ-1.36.a",
  "REQ-1.36.b",
  "REQ-10.3.3",
  "REQ-11.3.8",
  "REQ-11.6",
  "REQ-15.2.6",
  "REQ-15.2.10",
  "REQ-20.3.8",
  "REQ-20.6",
  "REQ-21.3.4",
  "REQ-23.3.1",
  "REQ-25.3.1",
  "REQ-27.3",
  "REQ-29.4.1",
  "REQ-29.4.2",
  "REQ-30.3.3",
  "REQ-36.4.1",
  "REQ-36.4.2",
] as const;

export const NINETEENTH_BATCH_HOLD_OUT_RULE_IDS = [
  "REQ-1.4.3",
  "REQ-1.5",
  "REQ-1.10",
  "REQ-1.13.4",
  "REQ-1.32.a",
  "REQ-1.32.c",
  "REQ-1.34",
  "REQ-7.3.5",
  "REQ-8.3.3",
  "REQ-9.3.5",
  "REQ-10.5",
  "REQ-11.3.2",
  "REQ-20.3.2",
  "REQ-21.3.2",
  "REQ-22.3.3",
  "REQ-23.3.4",
  "REQ-24.3.3",
  "REQ-25.3.4",
  "REQ-26.3.2",
  "REQ-27.5",
  "REQ-30.8.1",
  "REQ-30.8.2",
  "REQ-33.7.1",
  "REQ-33.7.2",
  "REQ-34.5",
  "REQ-35.5",
] as const;

export type NineteenthExecutableBatchRuleId =
  (typeof NINETEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type NineteenthExecutableBatchLiveKey =
  (typeof NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type NineteenthBatchLiveFactKey =
  | "awarded_hhs"
  | "awarded_pps"
  | "awarded_rhs"
  | "awarded_hhs_rhs"
  | "awarded_els"
  | "awarded_pba"
  | "awarded_rp3"
  | "awarded_rp5"
  | "awarded_sec"
  | "awarded_see"
  | "awarded_sei"
  | "awarded_tfb"
  | "contractor_standing_file";

export type NineteenthBatchEngineBinding = {
  ruleId: NineteenthExecutableBatchRuleId;
  liveKeys: readonly NineteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_service_leftover" | "contractor_file_reeval";
  evidence: "hybrid_record" | "upload_file";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review" | "upload_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: NineteenthBatchLiveFactKey;
  awardedCodes: readonly string[];
  factId: string | null;
  disposition: "standing";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Standing invent-3 leftover file — keep current. Do not invent hire+N, annual-from-completion, vague-comply OL clocks, UPI employee-registry clocks, license umbrellas, grandfather dates, or home-condition umbrellas.",
};

type FamilyMeta = {
  title: string;
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  evidence: NineteenthBatchEngineBinding["evidence"];
  adminReview: NineteenthBatchEngineBinding["adminReview"];
  predicateKind: PredicateKind;
  assignment: NineteenthBatchEngineBinding["assignment"];
};

const CONTRACTOR_STANDING_KEYS = new Set<NineteenthExecutableBatchLiveKey>([
  "dnr_order_access",
  "pcsp_person_review",
  "fatality_notification",
  "sc_records_on_request",
  "usdc_transition",
]);

const FAMILIES: Readonly<Record<NineteenthExecutableBatchLiveKey, FamilyMeta>> = {
  dnr_order_access: {
    title: "DNR Order Access Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live DNR-access leftover file is the handling path. Official workbook clause_text stays the member label. FACT-068 stays a question when unanswered.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  pcsp_person_review: {
    title: "PCSP Orientation and PCPT Review Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live PCSP orientation / PCPT review leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  fatality_notification: {
    title: "Fatality Notification Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live fatality-notification leftover file is the handling path. Punch pad stays the incident clock. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  sc_records_on_request: {
    title: "Support Coordinator Records-on-Request Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live Support Coordinator records-on-request leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  residential_group_mix: {
    title: "Residential Group-Mix Approval Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live HHS/RHS group-mix approval leftover file is the handling path. Grandfather REQ-1.32.a and OL-portal REQ-1.32.c stay invent-blocked. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  usdc_transition: {
    title: "USDC Transition Coordination Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live USDC transition leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  els_school_age: {
    title: "ELS School-Age Temporary Use Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live ELS school-age leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  host_contractor_change: {
    title: "HHS/PPS Host Contractor-Change Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live HHS/PPS host contractor-change leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  host_staff_qualifications: {
    title: "HHS/PPS Host Staff Age Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live HHS/PPS host/staff age leftover file is the handling path. Hosts never clock. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  pba_monthly_fiduciary: {
    title: "PBA Monthly Fiduciary Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live PBA monthly fiduciary leftover file is the handling path. Separate from the 15.3 administrative review card. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  rhs_form_930: {
    title: "RHS Form 930 Enhanced Staffing Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live RHS Form 930 leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  form_929_exceptional_care: {
    title: "Form 929 Exceptional-Care Respite Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live DSPD Form 929 leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  sec_pass_documentation: {
    title: "SEC Pass-Through and Co-Worker Support Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live SEC pass-through leftover file is the handling path. Official workbook clause_text stays the member label. Staff never touch UPI.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  see_staff_training: {
    title: "SEE Staff Training Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live SEE staff-training leftover file is the handling path. Official workbook clause_text stays the member label. Do not reuse acre_sei / acre_sed / acre_sjd.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  sei_job_termination: {
    title: "SEI Job-Termination Notice Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live SEI job-termination leftover file is the handling path. Notify USOR — staff never touch UPI. Official workbook clause_text stays the member label.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  tfb_staff_qualifications: {
    title: "TFB Staff Qualifications Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live TFB staff-qualification leftover file is the handling path. Official workbook clause_text stays the member label. Do not invent a CST parent.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
};

const OFFICIAL = {
  "REQ-1.10.14":
    "(14) DNR orders accessible to Staff in the Person's service settings. The Contractor shall solicit input from the Person on the desired location of their DNR order.",
  "REQ-1.24.7":
    "(7) orient the Person to the portion of the PCSP applicable to the Contractor and ensure the Person is involved in PCSP implementation;",
  "REQ-1.24.9":
    "(9) meet with the PCPT to review the Person's services and support needs and make any necessary adjustments based on the Person's needs. The Contractor shall meet with the PCPT at least annually, within 12 months of the last PCSP meeting, or more often as determined by the Person or other PCPT members.",
  "REQ-1.26":
    "1.26 Fatality Notifications and Reviews. In addition to the requirements in Attachment A: State of Utah DHHS Client Services Terms, upon discovery of the death of a Person receiving its services, the Contractor shall notify the Person's family as soon as reasonably possible (24 hours at the latest). The Contractor shall notify the Person's Support Coordinator and the DSPD Waiver Manager at waivermanager@utah.gov by the end of the next Calendar Day.",
  "REQ-1.31.2":
    "(2) furnish copies of licensing and site certification records to Support Coordinators upon their request; and",
  "REQ-1.31.3":
    "(3) furnish timesheet records to Support Coordinators within three Calendar Days of request.",
  "REQ-1.32.b":
    "(b) For residential services (RHS or HHS) in a certified setting that have adult and minor services together, or that have Persons and individuals not funded by DSPD together, the Contractor shall, prior to placement, obtain written approval from:",
  "REQ-1.36.a":
    "(a) When a Person is transitioning into services with the Contractor from USDC, the Contractor may be required to provide the Person with Behavior Supports, Day Supports, Supported Living, or Professional Nursing services as coordinated by the DHHS/DSPD Transition team. This may include allowing the Person to spend time with new Staff so they can learn about the Person.",
  "REQ-1.36.b":
    "(b) If a Person is admitting into services with USDC, the Contractor shall coordinate with the DHHS/DSPD Transition team and USDC, as needed, to assist with a successful admission. This may include allowing USDC employees to attend service delivery to allow the Person to spend time with new employees so they can learn about the Person prior to admission to USDC.",
  "REQ-10.3.3":
    "(3) for school age individuals, only use ELS in temporary situations. For ongoing support during traditional school hours documentation from the school district that supports shortened school hours (including a copy of the Individualized Education Plan) will be required.",
  "REQ-11.3.8":
    "(8) when a HHS Staff is transitioning employment from one DSPD Contractor to another DSPD Contractor, both Contractors shall notify the Support Coordinator of the Person who is receiving HHS from the transitioning HHS home that there is a potential change in the contracted provider. Both Contractors must allow the Support Coordinator to ensure the Person is making an Informed Choice about the Contractor the Person wants to receive services from, prior to any change happening. Neither of the Contractors shall attempt to influence the Person's choice;",
  "REQ-11.6":
    "11.6 Specific Staff Qualifications. The Contractor shall ensure the hosts are at least 21 years of age.",
  "REQ-15.2.6":
    "(6) monitor the Person's assets on at least a monthly basis to ensure that assets do not exceed asset limits. When funds are approaching asset limits, this information must be communicated to the Person, their residential provider, and Support Coordinator;",
  "REQ-15.2.10":
    "(10) review the Person's financial records with the Person at least monthly. This review may be completed virtually. This review is separate from the administrative review. The Contractor shall review all deposits, expenditures, savings, and any other relevant information regarding the state of the Person's finances.",
  "REQ-20.3.8":
    "(8) when a PPS Staff is transitioning employment from one DSPD Contractor to another DSPD Contractor, both Contractors shall notify the Support Coordinator of the Person who is receiving PPS from the transitioning PPS home that there is a potential change in the contracted provider. Both Contractors must allow the Support Coordinator to ensure the Person is making an Informed Choice about the Contractor the Person wants to receive services from, prior to any change happening. Neither of the Contractors shall attempt to influence the Person's choice;",
  "REQ-20.6": "20.6 Specific Staff Qualifications. PPS Staff must be at least 21 years of age.",
  "REQ-21.3.4":
    "(4) have a completed form 930 prior to providing services with enhanced Staffing. Enhanced Staffing includes four or more hours per day of a Staff ratio of one Staff providing Direct Support to one Person;",
  "REQ-23.3.1": "(1) complete DSPD Form 929 prior to providing services;",
  "REQ-25.3.1": "(1) complete DSPD Form 929 prior to providing services;",
  "REQ-27.3":
    "27.3 Direct Service Administrative Requirements. The Contractor shall maintain documentation of the pass through funds and co-worker supports the Person received.",
  "REQ-29.4.1": "(1) prior to providing services, ensure SEE Staff have successfully completed:",
  "REQ-29.4.2":
    "(2) be signed up for and complete the first available Workplace Supports Training or Effective Job Coach Training through Utah State University. Workplace Supports and Effective Job Coaching Training can only be accessed as a minimum training requirement in SEE when Staff is supervised by another ACRE or Customized Employment trained Staff and the individual employment support only requires job coaching to maintain existing business tasks. Direct Service Requirements outlined in 28.2 to learn new tasks and develop and grow business shall be completed by ACRE or Customized Employment trained Staff.",
  "REQ-30.3.3":
    "(3) if a Person's job is terminated: (A) notify the Utah State Office of Rehabilitation within one Business Day; and (B) conduct a review of the circumstances of the job loss and modify the PSCP and employment goals to address the new needs;",
  "REQ-36.4.1": "1. a bachelor's degree in social or behavioral sciences; and",
  "REQ-36.4.2":
    "2. one year, within the past five years, of work experience providing training to people with ID.RC and/or ABI and their families.",
} as const;

type ChildSpec = {
  id: NineteenthExecutableBatchRuleId;
  liveKey: NineteenthExecutableBatchLiveKey;
  section: string;
  codes: readonly string[];
  factId: string | null;
  question: string | null;
  liveFactKey: NineteenthBatchLiveFactKey;
};

const SPECS: readonly ChildSpec[] = [
  {
    id: "REQ-1.10.14",
    liveKey: "dnr_order_access",
    section: "1.10(14)",
    codes: [],
    factId: "FACT-068",
    question: "Does the client have a DNR order?",
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.24.7",
    liveKey: "pcsp_person_review",
    section: "1.24(7)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.24.9",
    liveKey: "pcsp_person_review",
    section: "1.24(9)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.26",
    liveKey: "fatality_notification",
    section: "1.26",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.31.2",
    liveKey: "sc_records_on_request",
    section: "1.31(2)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.31.3",
    liveKey: "sc_records_on_request",
    section: "1.31(3)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.32.b",
    liveKey: "residential_group_mix",
    section: "1.32(b)",
    codes: ["HHS", "RHS"],
    factId: null,
    question: null,
    liveFactKey: "awarded_hhs_rhs",
  },
  {
    id: "REQ-1.36.a",
    liveKey: "usdc_transition",
    section: "1.36(a)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.36.b",
    liveKey: "usdc_transition",
    section: "1.36(b)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-10.3.3",
    liveKey: "els_school_age",
    section: "10.3(3)",
    codes: ["ELS"],
    factId: "FACT-026",
    question: "Agency awarded ELS?",
    liveFactKey: "awarded_els",
  },
  {
    id: "REQ-11.3.8",
    liveKey: "host_contractor_change",
    section: "11.3(8)",
    codes: ["HHS"],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    liveFactKey: "awarded_hhs",
  },
  {
    id: "REQ-11.6",
    liveKey: "host_staff_qualifications",
    section: "11.6",
    codes: ["HHS"],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    liveFactKey: "awarded_hhs",
  },
  {
    id: "REQ-15.2.6",
    liveKey: "pba_monthly_fiduciary",
    section: "15.2(6)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
    liveFactKey: "awarded_pba",
  },
  {
    id: "REQ-15.2.10",
    liveKey: "pba_monthly_fiduciary",
    section: "15.2(10)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
    liveFactKey: "awarded_pba",
  },
  {
    id: "REQ-20.3.8",
    liveKey: "host_contractor_change",
    section: "20.3(8)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-20.6",
    liveKey: "host_staff_qualifications",
    section: "20.6",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-21.3.4",
    liveKey: "rhs_form_930",
    section: "21.3(4)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-23.3.1",
    liveKey: "form_929_exceptional_care",
    section: "23.3(1)",
    codes: ["RP3"],
    factId: "FACT-032",
    question: "Agency awarded RP3?",
    liveFactKey: "awarded_rp3",
  },
  {
    id: "REQ-25.3.1",
    liveKey: "form_929_exceptional_care",
    section: "25.3(1)",
    codes: ["RP5"],
    factId: "FACT-028",
    question: "Agency awarded RP5?",
    liveFactKey: "awarded_rp5",
  },
  {
    id: "REQ-27.3",
    liveKey: "sec_pass_documentation",
    section: "27.3",
    codes: ["SEC"],
    factId: "FACT-039",
    question: "Agency awarded SEC?",
    liveFactKey: "awarded_sec",
  },
  {
    id: "REQ-29.4.1",
    liveKey: "see_staff_training",
    section: "29.4(1)",
    codes: ["SEE"],
    factId: "FACT-027",
    question: "Agency awarded SEE?",
    liveFactKey: "awarded_see",
  },
  {
    id: "REQ-29.4.2",
    liveKey: "see_staff_training",
    section: "29.4(2)",
    codes: ["SEE"],
    factId: "FACT-027",
    question: "Agency awarded SEE?",
    liveFactKey: "awarded_see",
  },
  {
    id: "REQ-30.3.3",
    liveKey: "sei_job_termination",
    section: "30.3(3)",
    codes: ["SEI"],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    liveFactKey: "awarded_sei",
  },
  {
    id: "REQ-36.4.1",
    liveKey: "tfb_staff_qualifications",
    section: "36.4(1)",
    codes: ["TFB"],
    factId: "FACT-040",
    question: "Agency awarded TFB?",
    liveFactKey: "awarded_tfb",
  },
  {
    id: "REQ-36.4.2",
    liveKey: "tfb_staff_qualifications",
    section: "36.4(2)",
    codes: ["TFB"],
    factId: "FACT-040",
    question: "Agency awarded TFB?",
    liveFactKey: "awarded_tfb",
  },
];

function tests(prefix: string, liveKey: NineteenthExecutableBatchLiveKey): DraftRuleTest[] {
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `The live ${liveKey} parent file plus the applicability predicate greens this leftover child on that card.`,
    },
    {
      id: `${prefix}-t2`,
      kind: "negative",
      assert:
        "A generic attestation without the live parent file leaves the leftover child incomplete. A known-false applicability fact does not open this clock.",
    },
    {
      id: `${prefix}-t3`,
      kind: "boundary",
      assert:
        "Leftover children stay on the invented parent card. Official catalog clause_text only. Do not invent vague-comply OL, UPI employee-registry, license-umbrella, grandfather, home-condition, or CST-only clocks. Never delete MAR/eMAR. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only.",
    },
  ];
}

function predicateFor(spec: ChildSpec): DraftPredicate {
  const family = FAMILIES[spec.liveKey];
  if (family.predicateKind === "awarded_service_codes") {
    return {
      kind: "awarded_service_codes",
      catalogKey: spec.liveKey,
      serviceCodes: spec.codes,
    };
  }
  return {
    kind: "contractor_standing_file",
    catalogKey: spec.liveKey,
  };
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
    predicates: [predicateFor(spec)],
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

export const NINETEENTH_BATCH_ENGINE_BINDINGS: readonly NineteenthBatchEngineBinding[] =
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
      factId: spec.factId,
      disposition: "standing",
      sharesLiveKeyWith: siblingIds,
    };
  });

export const NINETEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse awarded-code facts; contractor leftovers stay standing",
    detail:
      "Awarded leftovers open on the matching service code. DNR, PCSP, fatality, SC-request, and USDC leftovers open as contractor standing files. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per invented leftover live key",
    detail:
      "Twenty-five leftover children collapse onto sixteen invented liveKeys. Child items stay on the parent. Product-blocked families stay invent-blocked.",
  },
  {
    step: "evidence",
    title: "Map official catalog clause_text — no invented SOW",
    detail:
      "Official workbook clause_text is the member label. Upload or the live leftover record is the handling path. Do not delete MAR/eMAR. Staff never touch UPI. EVV stays CSV only.",
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
      "Standing leftover files stay keep-current. Do not invent hire+N, annual-from-completion, vague-comply OL, UPI employee-registry, license-umbrella, grandfather, or home-condition clocks.",
  },
] as const;

export function isNineteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (NINETEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isNineteenthExecutableBatchLiveKey(key: string): boolean {
  return (NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function nineteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function nineteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyNineteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = nineteenthBatchFixtureFor(rule.id);
  if (!fixture || !isNineteenthExecutableBatchRuleId(rule.id)) return rule;
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
            nineteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyNineteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyNineteenthExecutableBatchOverlay(rule));
}

export function nineteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isNineteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyNineteenthExecutableBatchOverlay(rule));
}

export function nineteenthBatchBindingForRule(
  ruleId: string,
): NineteenthBatchEngineBinding | null {
  return NINETEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function nineteenthBatchLiveEngineReady(row: NineteenthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isNineteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on the sixteen invented leftover liveKeys.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function nineteenthBatchAssignmentOpensClock(
  liveKey: NineteenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  if (CONTRACTOR_STANDING_KEYS.has(liveKey)) return true;
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function nineteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function nineteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isNineteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyNineteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isNineteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function nineteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return NINETEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as NineteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function nineteenthBatchExpectedLiveKey(
  ruleId: NineteenthExecutableBatchRuleId,
): NineteenthExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown nineteenth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function nineteenthBatchOfficialClause(ruleId: NineteenthExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function nineteenthBatchOmitsBlockedFamilies(): boolean {
  const keys = NINETEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = NINETEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("dnr_order_access") &&
    keys.includes("form_929_exceptional_care") &&
    !keys.includes("client_specific_training") &&
    !keys.includes("acre_sei") &&
    !keys.includes("pm_nursing_file") &&
    !keys.includes("sjd_discovery_vocational") &&
    !rules.includes("REQ-1.4.3") &&
    !rules.includes("REQ-1.5") &&
    !rules.includes("REQ-1.10") &&
    !rules.includes("REQ-1.13.4") &&
    !rules.includes("REQ-1.32.a") &&
    !rules.includes("REQ-1.32.c") &&
    !rules.includes("REQ-1.34") &&
    !rules.includes("REQ-7.3.5") &&
    !rules.includes("REQ-10.5") &&
    !rules.includes("REQ-11.3.2") &&
    !rules.includes("REQ-27.5") &&
    !rules.includes("REQ-30.8.1") &&
    !rules.includes("REQ-33.7.1") &&
    !rules.includes("REQ-34.5") &&
    !rules.includes("REQ-16.2.3") &&
    !rules.includes("REQ-33.2.a") &&
    rules.includes("REQ-1.10.14") &&
    rules.includes("REQ-23.3.1")
  );
}
