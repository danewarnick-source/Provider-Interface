/**
 * Eighteenth shared-behavior executable batch: MEGA invent-2 —
 * combined inventable leftover families.
 *
 * Invents ten pack liveKeys and awarded-code / contractor-standing
 * predicates. Official catalog clause_text only — do not invent SOW.
 * REQ-34.5 / REQ-35.5 stay invent-blocked contractor-qualification
 * umbrellas (must hold another DHHS91172 code) — not RFS packets.
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

export const EIGHTEENTH_EXECUTABLE_BATCH_ID = "combined_inventable_leftovers" as const;

export const EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "sjd_discovery_vocational",
  "household_12plus_background",
  "medicaid_eligibility_assist",
  "dhhs_quality_remediation",
  "program_day_to_day_staff",
  "employment_assessment_fade",
  "milestone_rfs",
  "epr_program_file",
  "bc_staff_qualifications",
  "rhs_housing_voucher",
] as const;

export const EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-33.2.a",
  "REQ-33.2.b",
  "REQ-33.2.c",
  "REQ-33.2.d",
  "REQ-33.2.e",
  "REQ-33.2.i",
  "REQ-33.2.j",
  "REQ-33.2.m",
  "REQ-11.3.1",
  "REQ-20.3.1",
  "REQ-22.3.2",
  "REQ-23.3.3",
  "REQ-24.3.2",
  "REQ-25.3.3",
  "REQ-11.2.7",
  "REQ-20.2.7",
  "REQ-21.2.6",
  "REQ-31.2.3",
  "REQ-1.19",
  "REQ-1.19.1",
  "REQ-1.19.2",
  "REQ-1.19.3",
  "REQ-7.3.4",
  "REQ-9.3.4",
  "REQ-10.3.1",
  "REQ-21.3.5",
  "REQ-28.2.3",
  "REQ-28.2.6",
  "REQ-29.2.a",
  "REQ-30.2.7",
  "REQ-34.3",
  "REQ-35.3",
  "REQ-9.2.2",
  "REQ-9.2.8",
  "REQ-9.5.1",
  "REQ-9.5.2",
  "REQ-3.6",
  "REQ-4.6",
  "REQ-5.6",
  "REQ-21.3.8",
  "REQ-21.3.8.A",
  "REQ-21.3.8.B",
  "REQ-21.3.8.C",
] as const;

export const EIGHTEENTH_BATCH_HOLD_OUT_RULE_IDS = [
  "REQ-1.4.3",
  "REQ-1.5",
  "REQ-1.13.4",
  "REQ-1.32.a",
  "REQ-1.34",
  "REQ-7.3.5",
  "REQ-8.3.3",
  "REQ-9.3.5",
  "REQ-10.5",
  "REQ-30.8.1",
  "REQ-30.8.2",
  "REQ-33.7.1",
  "REQ-33.7.2",
  "REQ-34.5",
  "REQ-35.5",
] as const;

export type EighteenthExecutableBatchRuleId =
  (typeof EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type EighteenthExecutableBatchLiveKey =
  (typeof EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type EighteenthBatchLiveFactKey =
  | "awarded_sjd"
  | "awarded_hhs"
  | "awarded_pps"
  | "awarded_rp2"
  | "awarded_rp3"
  | "awarded_rp4"
  | "awarded_rp5"
  | "awarded_rhs"
  | "awarded_slh"
  | "awarded_dsg_dsp"
  | "awarded_epr"
  | "awarded_els"
  | "awarded_sed"
  | "awarded_see"
  | "awarded_sei"
  | "awarded_sjp"
  | "awarded_sjr"
  | "awarded_bc1"
  | "awarded_bc2"
  | "awarded_bc3"
  | "contractor_standing_file";

export type EighteenthBatchEngineBinding = {
  ruleId: EighteenthExecutableBatchRuleId;
  liveKeys: readonly EighteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "awarded_service_leftover" | "contractor_file_reeval";
  evidence: "hybrid_record" | "upload_file";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "record_review" | "upload_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: EighteenthBatchLiveFactKey;
  awardedCodes: readonly string[];
  factId: string | null;
  disposition: "standing";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Standing invent-2 leftover file — keep current. Do not invent hire+N, annual-from-completion, UPI employee-registry clocks, or contractor-qualification umbrellas.",
};

type FamilyMeta = {
  title: string;
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  evidence: EighteenthBatchEngineBinding["evidence"];
  adminReview: EighteenthBatchEngineBinding["adminReview"];
  predicateKind: PredicateKind;
  assignment: EighteenthBatchEngineBinding["assignment"];
};

const FAMILIES: Readonly<Record<EighteenthExecutableBatchLiveKey, FamilyMeta>> = {
  sjd_discovery_vocational: {
    title: "SJD Discovery / Vocational Assessment Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live SJD discovery / vocational leftover file is the handling path. Official workbook clause_text stays the member label. Staff never touch UPI.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  household_12plus_background: {
    title: "Household 12+ Background Screening Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live household 12+ background leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  medicaid_eligibility_assist: {
    title: "Medicaid Eligibility Review Assistance Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live Medicaid eligibility-review assistance leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  dhhs_quality_remediation: {
    title: "DHHS Quality Remediation Plan Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live DHHS quality Remediation Plan leftover file is the handling path. Official workbook clause_text stays the member label. Contractor-wide — not an awarded-code clock.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "contractor_standing_file",
    assignment: "contractor_file_reeval",
  },
  program_day_to_day_staff: {
    title: "Day-to-Day Program Staff Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live day-to-day program-staff leftover file is the handling path. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  employment_assessment_fade: {
    title: "SED/SEE/SEI Assessment and Fade Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live SED/SEE/SEI assessment-and-fade leftover file is the handling path. Official workbook clause_text stays the member label. Staff never touch UPI.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  milestone_rfs: {
    title: "SJP/SJR Milestone Request for Services Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live SJP/SJR milestone RFS leftover file is the handling path. REQ-34.5 / REQ-35.5 stay invent-blocked. Official workbook clause_text stays the member label. Staff never touch UPI.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  epr_program_file: {
    title: "EPR Program File Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live EPR leftover file is the handling path for Informed Choice, 511, pre-vocational staff training, and supervisory ACRE / Workplace Supports / Effective Job Coach. Do not reuse acre_sei / acre_sed / acre_sjd. Official workbook clause_text stays the member label.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  bc_staff_qualifications: {
    title: "BC Staff Qualifications Leftovers",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "The live BC staff-qualification leftover file is the handling path. Official workbook clause_text stays the member label. Rights-modification twins stay unwired.",
    evidence: "upload_file",
    adminReview: "upload_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
  rhs_housing_voucher: {
    title: "RHS Housing Voucher Leftovers",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live RHS housing-voucher leftover file is the handling path. Official workbook clause_text stays the member label. The Contractor or Support Coordinator may not request voucher termination.",
    evidence: "hybrid_record",
    adminReview: "record_review",
    predicateKind: "awarded_service_codes",
    assignment: "awarded_service_leftover",
  },
};

const OFFICIAL = {
  "REQ-33.2.a":
    "(a) The Contractor shall determine if a Discovery Process or a Vocational Assessment should be completed for the Person to obtain Competitive Integrated Employment. The Discovery Process should be completed with the Person, unless the Contractor:",
  "REQ-33.2.b":
    "(b) The Contractor shall complete an assessment of the Person's transportation needs related to obtaining and maintaining Competitive Integrated Employment.",
  "REQ-33.2.c":
    "(c) Unless determined as outlined above in 33.2 (1) that a Vocational Assessment should be completed, the Contractor shall complete a Discovery Process to obtain Customized Employment, using the Individualized Strengths-based Job Discovery Assessment that is posted on the DSPD webpage. The Contractor shall complete the Individualized Strengths-based Job Discovery Assessment within 60 Calendars Days of the start of the assessment. The Contractor shall complete a comprehensive assessment of the Person's interests, goals, existing strengths, existing skills, and conditions for Customized Employment success through activities of the Person's typical life by completing the following activities:",
  "REQ-33.2.d":
    "(d) As a result of the Discovery Process, the Contractor shall document a detailed employment profile in the Individualized Strengths-based Job Discovery Assessment. The Contractor shall ensure the employment profile includes:",
  "REQ-33.2.e":
    "(e) When determined by the PCST that the Person should complete a Vocational Assessment, the Contractor shall use the Vocational Assessment posted on the DSPD webpage, and complete the assessment within 30 calendar days of the start of the assessment. The Vocational Assessment must result in a documented detailed Employment Plan that identifies:",
  "REQ-33.2.i":
    "(i) The Contractor shall conduct an analysis on potential employment pay and benefits to determine how employment pay and benefits will interact with existing benefits the Person is receiving (i.e. Social Security Income, Title 2 benefits, Medicaid) and advise the Person on potential changes to their existing benefits.",
  "REQ-33.2.j":
    "(j) The Contractor shall meet in-person with the Person at least weekly to assess progress towards their employment goals. The assessment must be documented in the monthly summary and include the Person's progress on each job strategy and all substantive information from meetings with the Person related to obtaining employment. If the Person is not progressing, the Contractor shall reevaluate the job strategy by:",
  "REQ-33.2.m":
    "(m) After employment has been obtained, the Contractor shall provide 30 days of job retention support to the Person that includes:",
  "REQ-11.3.1":
    "(1) prior to providing services, individuals who are 12 or older who have resided in the HHS home for any cumulative thirty day period of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-20.3.1":
    "(1) prior to providing services, individuals who are 12 or older who have resided in the PPS home for any cumulative thirty day period of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-22.3.2":
    "(2) when providing RP2 in the Staff's private residence, prior to providing services, ensure individuals who are 12 or older who reside in the home for any cumulative thirty days of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-23.3.3":
    "(3) when providing RP3 in the Staff's private residence, prior to providing services, ensure individuals who are 12 or older who reside in the home for any cumulative thirty days of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-24.3.2":
    "(2) when providing RP2 in the Staff's private residence, prior to providing services, ensure individuals who are 12 or older who reside in the home for any cumulative thirty days of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-25.3.3":
    "(3) when providing RP5 in the Staff's private residence, prior to providing services, ensure individuals who are 12 or older who reside in the home for any cumulative thirty days of the past 12 months comply with the background screening requirements in Utah Code §26B-2-120 and Utah Administrative Code R501-14;",
  "REQ-11.2.7":
    "(7) assist the Person with completing any Medicaid eligibility review documents, and ensure they are submitted timely; and",
  "REQ-20.2.7":
    "(7) assist the Person with completing any Medicaid eligibility review documents, and ensure they are submitted timely; and",
  "REQ-21.2.6":
    "(6) assist the Person with completing any necessary Medicaid eligibility review documents, and ensure they are submitted timely; and",
  "REQ-31.2.3":
    "(3) assistance with completing Medicaid eligibility review documents, and ensure they are submitted timely; and",
  "REQ-1.19":
    "1.19 DHHS Quality Monitoring Process. The Contractor shall cooperate with review and requirements from the DHHS quality management team. If DHHS identifies a deficiency that requires a Remediation Plan from the Contractor, the Contractor shall:",
  "REQ-1.19.1":
    "(1) submit to the DHHS quality management team a written Remediation Plan that responds to each identified deficiency according to the instructions provided by the DHHS quality management representative;",
  "REQ-1.19.2": "(2) submit the response within the required timeframes; and",
  "REQ-1.19.3":
    "(3) submit a revised Remediation Plan within seven Calendar Days if the Contractor's response is determined unacceptable by DHHS. If a revised Remediation Plan is determined to be unacceptable by DHHS, the Contractor may receive sanctions pursuant to the terms of this contract. The Contractor may appeal sanctions to DHHS.",
  "REQ-7.3.4":
    "(4) ensure that each DSG/DSP program has Staff responsible for the day to day operations of the program;",
  "REQ-9.3.4":
    "(4) ensure that each EPR program has Staff responsible for the day to day operations of the program;",
  "REQ-10.3.1":
    "(1) ensure for each ELS site, there is a Staff who is responsible for the day to day operations.;",
  "REQ-21.3.5":
    "(5) have a Staff that is responsible for the day to day operations of the program at each site that RHS is provided;",
  "REQ-28.2.3":
    "(3) assess the Person's individual skills, interests, preferences, transferable skills, accommodations and potential workplace barriers to prepare them for individual Competitive Integrated Employment. Assessments must take place at an approved facility, employment site, or in the community;",
  "REQ-28.2.6":
    "(6) maintain written plans, supports and strategies intended to increase on-the-job independence and fade paid employment services.",
  "REQ-29.2.a":
    "(a) The Contractor shall conduct assessments with the Person to determine interests, preferences, transferable skills, accommodations and potential workplace barriers of the Person before self-employment. The Contractor shall provide assessments at an approved facility or employment site.",
  "REQ-30.2.7":
    "(7) maintain written plans, supports and strategies intended to increase on-the-job independence and fade paid employment services; and",
  "REQ-34.3":
    "34.3 Milestone Payment Administrative Requirements. After the Person has met the milestone payment requirements for SJP, the Contractor shall submit a written request to the Person's Support Coordinator to complete a Request for Services (\"RFS\") for the Contractor to be considered to receive the SJP milestone payment. The Contractor shall provide the Person's Support Coordinator with the following documentation to complete the RFS:",
  "REQ-35.3":
    "35.3 Milestone Payment Administrative Requirements. After the Person has met the milestone payment requirements for SJR, the Contractor shall submit a written request to the Person's Support Coordinator to complete an RFS for the Contractor to be considered to receive the SJR payment. The Contractor shall provide the Person's Support Coordinator with the following documentation to complete the RFS:",
  "REQ-9.2.2":
    "(2) within the first 60 days of a Person receiving EPR, document in writing an Informed Choice conversation with the Person and their PCST that includes EPR is not a permanent service, Person's goals, and a plan regarding what will occur after EPR ends;",
  "REQ-9.2.8":
    "(8) coordinate with the USOR to ensure the Person receives 511 Career Counseling at least annually, and to prepare the Person to obtain, maintain, advance in, or regain Competitive Integrated Employment; and",
  "REQ-9.5.1":
    "(1) prior to working with Persons, Staff must be trained on best practices for supporting Persons with pre-vocational goals; and",
  "REQ-9.5.2":
    "(2) at least one EPR supervisory Staff at each EPR program has completed Association of Community Rehabilitation Educators (\"ACRE\") training, Utah State University Workplace Supports training, or Effective Job Coach training prior to providing EPR. The Contractor shall ensure that all EPR supervisory Staff complete and maintain either of the required training within 90 days of employment.",
  "REQ-3.6":
    "3.6 Specific Staff Qualifications. The Contractor shall ensure that the BCI Staff meet the qualifications listed in Option A or B below.",
  "REQ-4.6":
    "4.6 Specific Staff Qualifications. The Contractor shall ensure that the BC2 Staff meet the qualifications in option A, B, C, or D below.",
  "REQ-5.6":
    "5.6 Specific Staff Qualifications. The Contractor shall ensure that the BC3 Staff meet the qualifications in option A, B, C, or D below.",
  "REQ-21.3.8": "(8) when a Person receives a Public Housing Authority voucher:",
  "REQ-21.3.8.A":
    "(A) meet with the Person and their PCPT when the housing voucher is initially approved and in annual PCPT meetings, to review Public Housing Authority requirements, including the Person's or their guardian's responsibilities, and the Contractor;",
  "REQ-21.3.8.B":
    "(B) contact the Person's Local Public Housing Authority case manager to coordinate moving the housing voucher if the Person intends to move to a different residence. The Contractor shall contact the Person's Local Public Housing Authority case manager prior to the Person moving. In an emergency situation where contact prior to the move is not possible, the Contractor shall contact the Person's Local Public Housing Authority case manager immediately after the move; and",
  "REQ-21.3.8.C":
    "(C) prior to terminating a housing voucher, meet with the Person and their PCPT to determine if terminating the voucher is in the Person's best interest. The Contractor shall ensure the Person or their guardian understands that terminating the housing voucher will require the Person to reapply if they need a housing voucher in the future, and they will likely be on a waiting list. If the Person chooses to terminate their housing voucher, the Person or their legal guardian must request to do so in writing to the Public Housing Authority. The Contractor or the Person's Support Coordinator may NOT request to terminate the Person's housing voucher.",
} as const;

type ChildSpec = {
  id: EighteenthExecutableBatchRuleId;
  liveKey: EighteenthExecutableBatchLiveKey;
  section: string;
  codes: readonly string[];
  factId: string | null;
  question: string | null;
  liveFactKey: EighteenthBatchLiveFactKey;
};

const SPECS: readonly ChildSpec[] = [
  {
    id: "REQ-33.2.a",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(a)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.b",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(b)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.c",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(c)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.d",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(d)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.e",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(e)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.i",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(i)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.j",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(j)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-33.2.m",
    liveKey: "sjd_discovery_vocational",
    section: "33.2(m)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
    liveFactKey: "awarded_sjd",
  },
  {
    id: "REQ-11.3.1",
    liveKey: "household_12plus_background",
    section: "11.3(1)",
    codes: ["HHS"],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    liveFactKey: "awarded_hhs",
  },
  {
    id: "REQ-20.3.1",
    liveKey: "household_12plus_background",
    section: "20.3(1)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-22.3.2",
    liveKey: "household_12plus_background",
    section: "22.3(2)",
    codes: ["RP2"],
    factId: "FACT-038",
    question: "Agency awarded RP2?",
    liveFactKey: "awarded_rp2",
  },
  {
    id: "REQ-23.3.3",
    liveKey: "household_12plus_background",
    section: "23.3(3)",
    codes: ["RP3"],
    factId: "FACT-032",
    question: "Agency awarded RP3?",
    liveFactKey: "awarded_rp3",
  },
  {
    id: "REQ-24.3.2",
    liveKey: "household_12plus_background",
    section: "24.3(2)",
    codes: ["RP4"],
    factId: "FACT-033",
    question: "Agency awarded RP4?",
    liveFactKey: "awarded_rp4",
  },
  {
    id: "REQ-25.3.3",
    liveKey: "household_12plus_background",
    section: "25.3(3)",
    codes: ["RP5"],
    factId: "FACT-028",
    question: "Agency awarded RP5?",
    liveFactKey: "awarded_rp5",
  },
  {
    id: "REQ-11.2.7",
    liveKey: "medicaid_eligibility_assist",
    section: "11.2(7)",
    codes: ["HHS"],
    factId: "FACT-004",
    question: "Agency awarded HHS?",
    liveFactKey: "awarded_hhs",
  },
  {
    id: "REQ-20.2.7",
    liveKey: "medicaid_eligibility_assist",
    section: "20.2(7)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-21.2.6",
    liveKey: "medicaid_eligibility_assist",
    section: "21.2(6)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-31.2.3",
    liveKey: "medicaid_eligibility_assist",
    section: "31.2(3)",
    codes: ["SLH"],
    factId: "FACT-034",
    question: "Agency awarded SLH?",
    liveFactKey: "awarded_slh",
  },
  {
    id: "REQ-1.19",
    liveKey: "dhhs_quality_remediation",
    section: "1.19",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.19.1",
    liveKey: "dhhs_quality_remediation",
    section: "1.19(1)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.19.2",
    liveKey: "dhhs_quality_remediation",
    section: "1.19(2)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-1.19.3",
    liveKey: "dhhs_quality_remediation",
    section: "1.19(3)",
    codes: [],
    factId: null,
    question: null,
    liveFactKey: "contractor_standing_file",
  },
  {
    id: "REQ-7.3.4",
    liveKey: "program_day_to_day_staff",
    section: "7.3(4)",
    codes: ["DSG", "DSP"],
    factId: "FACT-015",
    question: "Agency awarded DSG,DSP?",
    liveFactKey: "awarded_dsg_dsp",
  },
  {
    id: "REQ-9.3.4",
    liveKey: "program_day_to_day_staff",
    section: "9.3(4)",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-10.3.1",
    liveKey: "program_day_to_day_staff",
    section: "10.3(1)",
    codes: ["ELS"],
    factId: "FACT-026",
    question: "Agency awarded ELS?",
    liveFactKey: "awarded_els",
  },
  {
    id: "REQ-21.3.5",
    liveKey: "program_day_to_day_staff",
    section: "21.3(5)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-28.2.3",
    liveKey: "employment_assessment_fade",
    section: "28.2(3)",
    codes: ["SED"],
    factId: "FACT-030",
    question: "Agency awarded SED?",
    liveFactKey: "awarded_sed",
  },
  {
    id: "REQ-28.2.6",
    liveKey: "employment_assessment_fade",
    section: "28.2(6)",
    codes: ["SED"],
    factId: "FACT-030",
    question: "Agency awarded SED?",
    liveFactKey: "awarded_sed",
  },
  {
    id: "REQ-29.2.a",
    liveKey: "employment_assessment_fade",
    section: "29.2(a)",
    codes: ["SEE"],
    factId: "FACT-027",
    question: "Agency awarded SEE?",
    liveFactKey: "awarded_see",
  },
  {
    id: "REQ-30.2.7",
    liveKey: "employment_assessment_fade",
    section: "30.2(7)",
    codes: ["SEI"],
    factId: "FACT-008",
    question: "Agency awarded SEI?",
    liveFactKey: "awarded_sei",
  },
  {
    id: "REQ-34.3",
    liveKey: "milestone_rfs",
    section: "34.3",
    codes: ["SJP"],
    factId: "FACT-049",
    question: "Agency awarded SJP?",
    liveFactKey: "awarded_sjp",
  },
  {
    id: "REQ-35.3",
    liveKey: "milestone_rfs",
    section: "35.3",
    codes: ["SJR"],
    factId: "FACT-050",
    question: "Agency awarded SJR?",
    liveFactKey: "awarded_sjr",
  },
  {
    id: "REQ-9.2.2",
    liveKey: "epr_program_file",
    section: "9.2(2)",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-9.2.8",
    liveKey: "epr_program_file",
    section: "9.2(8)",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-9.5.1",
    liveKey: "epr_program_file",
    section: "9.5(1)",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-9.5.2",
    liveKey: "epr_program_file",
    section: "9.5(2)",
    codes: ["EPR"],
    factId: "FACT-012",
    question: "Agency awarded EPR?",
    liveFactKey: "awarded_epr",
  },
  {
    id: "REQ-3.6",
    liveKey: "bc_staff_qualifications",
    section: "3.6",
    codes: ["BC1"],
    factId: "FACT-010",
    question: "Agency awarded BC1?",
    liveFactKey: "awarded_bc1",
  },
  {
    id: "REQ-4.6",
    liveKey: "bc_staff_qualifications",
    section: "4.6",
    codes: ["BC2"],
    factId: "FACT-013",
    question: "Agency awarded BC2?",
    liveFactKey: "awarded_bc2",
  },
  {
    id: "REQ-5.6",
    liveKey: "bc_staff_qualifications",
    section: "5.6",
    codes: ["BC3"],
    factId: "FACT-011",
    question: "Agency awarded BC3?",
    liveFactKey: "awarded_bc3",
  },
  {
    id: "REQ-21.3.8",
    liveKey: "rhs_housing_voucher",
    section: "21.3(8)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-21.3.8.A",
    liveKey: "rhs_housing_voucher",
    section: "21.3(8)(A)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-21.3.8.B",
    liveKey: "rhs_housing_voucher",
    section: "21.3(8)(B)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-21.3.8.C",
    liveKey: "rhs_housing_voucher",
    section: "21.3(8)(C)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
];

function tests(prefix: string, liveKey: EighteenthExecutableBatchLiveKey): DraftRuleTest[] {
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
        "Leftover children stay on the invented parent card. Official catalog clause_text only. Do not invent UPI employee-registry clocks or contractor-qualification umbrellas. Never delete MAR/eMAR. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only.",
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

export const EIGHTEENTH_BATCH_ENGINE_BINDINGS: readonly EighteenthBatchEngineBinding[] =
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

export const EIGHTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse awarded-code facts; DHHS quality is contractor-standing",
    detail:
      "Awarded leftovers open on the matching service code. DHHS quality Remediation Plan leftovers open as a contractor standing file. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per invented leftover live key",
    detail:
      "Forty-three leftover children collapse onto ten invented liveKeys. Child items stay on the parent. REQ-34.5 / REQ-35.5 stay invent-blocked.",
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
      "Standing leftover files stay keep-current. Do not invent hire+N, annual-from-completion, UPI employee-registry clocks, or contractor-qualification umbrellas.",
  },
] as const;

export function isEighteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isEighteenthExecutableBatchLiveKey(key: string): boolean {
  return (EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function eighteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function eighteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
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

export function applyEighteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = eighteenthBatchFixtureFor(rule.id);
  if (!fixture || !isEighteenthExecutableBatchRuleId(rule.id)) return rule;
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
            eighteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyEighteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyEighteenthExecutableBatchOverlay(rule));
}

export function eighteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isEighteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyEighteenthExecutableBatchOverlay(rule));
}

export function eighteenthBatchBindingForRule(
  ruleId: string,
): EighteenthBatchEngineBinding | null {
  return EIGHTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function eighteenthBatchLiveEngineReady(row: EighteenthBatchEngineBinding): {
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
    reasons.push("This batch does not invent an in-Hive course.");
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
  if (row.liveKeys.length !== 1 || !isEighteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on the ten invented leftover liveKeys.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function eighteenthBatchAssignmentOpensClock(
  liveKey: EighteenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  if (liveKey === "dhhs_quality_remediation") return true;
  const codes = awardedCodes ?? sowCatalogEntryByKey(liveKey)?.service_codes ?? [];
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function eighteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function eighteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isEighteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyEighteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isEighteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function eighteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return EIGHTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as EighteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function eighteenthBatchExpectedLiveKey(
  ruleId: EighteenthExecutableBatchRuleId,
): EighteenthExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown eighteenth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function eighteenthBatchOfficialClause(ruleId: EighteenthExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function eighteenthBatchOmitsBlockedFamilies(): boolean {
  const keys = EIGHTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = EIGHTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("sjd_discovery_vocational") &&
    keys.includes("epr_program_file") &&
    !keys.includes("acre_sei") &&
    !keys.includes("acre_sjd") &&
    !keys.includes("sei_monthly_summary_upi") &&
    !keys.includes("pm_nursing_file") &&
    !keys.includes("client_specific_training") &&
    !rules.includes("REQ-1.4.3") &&
    !rules.includes("REQ-1.34") &&
    !rules.includes("REQ-7.3.5") &&
    !rules.includes("REQ-10.5") &&
    !rules.includes("REQ-30.8.1") &&
    !rules.includes("REQ-33.7.1") &&
    !rules.includes("REQ-34.5") &&
    !rules.includes("REQ-35.5") &&
    !rules.includes("REQ-16.2.3") &&
    rules.includes("REQ-34.3") &&
    rules.includes("REQ-9.2.2")
  );
}
