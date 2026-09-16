/**
 * Fifteenth shared-behavior executable batch: Article 1 standing leftover
 * children (MEGA A only).
 *
 * Same leftover-child attach as FY `.c` twins and evac `.6` — wire imported
 * leftover parents onto existing pack liveKeys. Children stay on the parent
 * card. Reuse existing predicates. Official catalog clause_text only — do
 * not invent SOW. Do not invent umbrellas. Do not start MEGA B
 * (incidents/HRC) or MEGA C (service leftovers). Hold out REQ-1.13.4 and
 * REQ-1.28.6. Publication stays off until VERIFIED_PUBLICATIONS is filled
 * deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import {
  UNIVERSAL_STAFF_KEYS,
  evaluateStaffDuty,
  staffReceivesDutyClock,
  type StaffDutyFacts,
} from "./duty-applicability.ts";
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
  TimingAnchor,
} from "./draft-rules/types.ts";

export const FIFTEENTH_EXECUTABLE_BATCH_ID = "article1_standing_leftover_children" as const;

export const FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "volunteer_training_file",
  "medicaid_manuals_memo",
  "medicaid_change_notifications",
  "medicaid_disclosure_annual",
  "governing_board_records",
  "personnel_policies",
  "operating_policies",
  "person_discharge_process",
  "health_support_policies",
  "medication_record",
  "medical_dental_exams",
  "emergency_loan_record",
  "driving_record_transport",
] as const;

export const FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.6.1",
  "REQ-1.6.2.B",
  "REQ-1.6.3",
  "REQ-1.6.3.B",
  "REQ-1.6.3.F",
  "REQ-1.7.3",
  "REQ-1.7.4",
  "REQ-1.13.1",
  "REQ-1.13.3",
  "REQ-1.13.5",
  "REQ-1.14.1",
  "REQ-1.14.2",
  "REQ-1.14.3",
  "REQ-1.14.4",
  "REQ-1.17.a",
  "REQ-1.17.b",
  "REQ-1.18.2",
  "REQ-1.18.5",
  "REQ-1.18.7",
  "REQ-1.22.a",
  "REQ-1.22.a.6",
  "REQ-1.22.b.3",
  "REQ-1.22.b.4",
  "REQ-1.22.c.1",
  "REQ-1.22.c.2",
  "REQ-1.22.c.3",
  "REQ-1.22.d",
  "REQ-1.23.a",
  "REQ-1.23.e",
  "REQ-1.23.f.1",
  "REQ-1.23.g.1",
  "REQ-1.23.b",
  "REQ-1.23.c",
  "REQ-1.23.d",
  "REQ-1.23.d.2",
  "REQ-1.23.h",
  "REQ-1.28.7.A",
  "REQ-1.28.7.B",
  "REQ-1.28.7.C",
  "REQ-1.28.7.D",
  "REQ-1.28.7.H",
  "REQ-1.28.7.I",
  "REQ-1.30.2",
  "REQ-1.30.3",
  "REQ-1.30.3.G",
] as const;

export const FIFTEENTH_BATCH_HOLD_OUT_RULE_IDS = ["REQ-1.13.4", "REQ-1.28.6"] as const;

export type FifteenthExecutableBatchRuleId = (typeof FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type FifteenthExecutableBatchLiveKey =
  (typeof FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type FifteenthBatchLiveFactKey =
  | "uses_volunteers"
  | "has_governing_board"
  | "staff_personnel_file"
  | "transport_assignment"
  | "contractor_standing_file";

export type FifteenthBatchEngineBinding = {
  ruleId: FifteenthExecutableBatchRuleId;
  liveKeys: readonly FifteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "contractor_file_reeval" | "hire_and_roster_reeval" | "caseload_reeval";
  evidence: "upload_file" | "external_then_upload" | "hybrid_record" | "upload_cert";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review" | "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: FifteenthBatchLiveFactKey;
  disposition: "standing" | "obligation" | "by_design" | "intake";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason: "Standing live-pack file — keep current. Calendar is reminder-only. Do not invent hire+N.",
};

const CONTRACTOR_CALENDAR_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Live pack calendar_year due_rule (Medicaid 101 July 31 / manuals Sept 28). Do not invent hire+N or annual-from-completion.",
};

const HIRE_ANNIVERSARY: TimingAnchor = { kind: "employment_year", startYear: 1 };

const EXISTING_WIRED_PARENTS: Readonly<Record<FifteenthExecutableBatchLiveKey, readonly string[]>> =
  {
    volunteer_training_file: ["REQ-1.6"],
    medicaid_manuals_memo: ["REQ-1.7.2"],
    medicaid_change_notifications: ["REQ-1.13.2"],
    medicaid_disclosure_annual: [],
    governing_board_records: ["REQ-1.14"],
    personnel_policies: [],
    operating_policies: ["REQ-1.18"],
    person_discharge_process: ["REQ-1.22.c"],
    health_support_policies: ["REQ-1.23"],
    medication_record: [],
    medical_dental_exams: [],
    emergency_loan_record: ["REQ-1.28.7"],
    driving_record_transport: ["REQ-1.30"],
  };

type FamilyMeta = {
  title: string;
  predicateKind: "contractor_standing_file" | "universal_staff" | "transport_assignment";
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  assignment: FifteenthBatchEngineBinding["assignment"];
  evidence: FifteenthBatchEngineBinding["evidence"];
  adminReview: FifteenthBatchEngineBinding["adminReview"];
  liveFactKey: FifteenthBatchLiveFactKey;
  disposition: FifteenthBatchEngineBinding["disposition"];
};

const FAMILIES: Readonly<Record<FifteenthExecutableBatchLiveKey, FamilyMeta>> = {
  volunteer_training_file: {
    title: "Volunteer Training File — When Volunteers Are Used",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the volunteer training file is the handling path when the volunteer fact is yes.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "uses_volunteers",
    disposition: "standing",
  },
  medicaid_manuals_memo: {
    title: "Utah Medicaid Provider Manuals — Annual Memo",
    predicateKind: "contractor_standing_file",
    timing: CONTRACTOR_CALENDAR_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the signed familiarity memo is the handling path, not a second annual clock per subsection.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "obligation",
  },
  medicaid_change_notifications: {
    title: "Medicaid Provider Change Notifications",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["EXTERNAL", "UPLOAD"],
    handling:
      "Logged notice to dspdcontracts@utah.gov is the handling path, not enrollment equivalency.",
    assignment: "contractor_file_reeval",
    evidence: "external_then_upload",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  medicaid_disclosure_annual: {
    title: "Medicaid Disclosure Form — Annual",
    predicateKind: "universal_staff",
    timing: HIRE_ANNIVERSARY,
    routes: ["UPLOAD", "EXTERNAL"],
    handling: "Upload of the signed Medicaid Disclosure form is the handling path.",
    assignment: "hire_and_roster_reeval",
    evidence: "upload_cert",
    adminReview: "upload_review",
    liveFactKey: "staff_personnel_file",
    disposition: "obligation",
  },
  governing_board_records: {
    title: "Governing or Policy-Making Board Records",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling: "Upload of by-laws and board minutes is the handling path when a board is recorded.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "has_governing_board",
    disposition: "standing",
  },
  personnel_policies: {
    title: "Personnel Policies and Job Descriptions",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of current personnel policies and written job descriptions is the handling path.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  operating_policies: {
    title: "Operating Policies and Procedures",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the current operating-policy set is the handling path, not a second clock per subsection.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  person_discharge_process: {
    title: "Person-discharge process — written procedure",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the written discharge procedure is the handling path, not a 30-day notice clock.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  health_support_policies: {
    title: "Health Support Policies and Procedures",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the current health-support policy set is the handling path, not a Person medical record.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  medication_record: {
    title: "Medication Record — When Contractor Supports Meds",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling: "The live medication record is the handling path when the contractor supports meds.",
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "contractor_standing_file",
    disposition: "by_design",
  },
  medical_dental_exams: {
    title: "Medical and Dental Examinations — Person File",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling: "The Person-file medical and dental examination record is the handling path.",
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "contractor_standing_file",
    disposition: "intake",
  },
  emergency_loan_record: {
    title: "Emergency Loan Documentation",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live client-loans record is the handling path, not a generic attestation and not a new form.",
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "contractor_standing_file",
    disposition: "by_design",
  },
  driving_record_transport: {
    title: "Driving Record — On File (Transporting Staff)",
    predicateKind: "transport_assignment",
    timing: HIRE_ANNIVERSARY,
    routes: ["UPLOAD"],
    handling:
      "Upload of the three file items is the handling path, not automatic equivalency for a non-driver.",
    assignment: "caseload_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "transport_assignment",
    disposition: "obligation",
  },
};

const OFFICIAL = {
  "REQ-1.6.1":
    "(1) ensure volunteers comply with all Staff qualifications and requirements;",
  "REQ-1.6.2.B":
    "(B) written permission from the Person's and their legal guardian, if applicable, must be obtained prior to a volunteer taking a Person overnight.",
  "REQ-1.6.3":
    "(3) ensure and maintain written documentation that volunteers who work on a regularly scheduled basis complete the following training requirements prior to providing support for Persons:",
  "REQ-1.6.3.B": "(B) requirements for reporting abuse and protecting human rights;",
  "REQ-1.6.3.F":
    "(F) the Contractor's policies and procedures applicable to the volunteer services provided.",
  "REQ-1.7.3":
    "(3) read, be familiar, and comply with DSPD rule R539 at https://adminrules.utah.gov/; and",
  "REQ-1.7.4":
    "(4) read, be familiar, and comply with all DHHS rules at https://adminrules.utah.gov.",
  "REQ-1.13.1":
    "(1) provide DSPD with complete and correct Medicaid Provider documents within seven Calendar Days of a written request from DSPD. The written request from DSPD will include a list of the required Medicaid Provider documents;",
  "REQ-1.13.3":
    "(3) notify the DSPD Contract Program Manager within 30 Calendar Days of any changes to its: (A) ownership; (B) legal corporate name; or (C) employer tax identification number;",
  "REQ-1.13.5":
    "(5) ensure and maintain Staff completion of the Medicaid Disclosure form at time of hire and annually thereafter. If Staff discloses any information on the Medicaid Disclosure form in violation of confidentiality requirements, the Contractor shall immediately notify DSPD; and",
  "REQ-1.14.1": "(1) maintain the by-laws of its organization and its governing board;",
  "REQ-1.14.2":
    "(2) convene meetings of its board at least quarterly or more frequently if the need arises;",
  "REQ-1.14.3":
    "(3) maintain minutes of the proceedings of that board that include the membership of the board and the attendees at each board meeting; and",
  "REQ-1.14.4":
    "(4) disclose its bylaws and minutes within three Calendar Days of request from any state or federal auditor or reviewer, DHHS, or DSPD representative.",
  "REQ-1.17.a":
    "(a) The Contractor shall have personnel policies and procedures to ensure adequate structure and organization for efficient and effective personnel management, and to comply with all personnel-related provisions of this contract and all state and federal personnel-related regulations.",
  "REQ-1.17.b":
    "(b) The personal policies and procedures must have written job descriptions for each Staff position that include a statement of duties and responsibilities, and the minimum qualifications for the position.",
  "REQ-1.18.2":
    "(2) if providing transportation, provisions that specify all transportation requirements pursuant to this contract and how compliance will be ensured;",
  "REQ-1.18.5":
    "(5) if the Contractor manages or assists with a Person's personal finances, provisions for the management of each Person's personal finances including: compliance with all Person's personal finances requirements ; how the Contractor will ensure compliance with all current regulation and policies of the Social Security Administration (\"SSA\"), if the Contractor is the Person's social security representative payee; and ensuring Persons do not continuously owe the Contractor money due to emergency situations;",
  "REQ-1.18.7":
    "(7) if the Contractor provides transportation, a policy that ensures compliance with all transportation requirements pursuant to this contract, and outlines what the Contractor determines to be an acceptable driving record for Staff to transport Persons.",
  "REQ-1.22.a":
    "(a) When a Person is discharged from services with the Contractor, the Contractor shall submit to the Person's Support Coordinator a discharge summary that includes:",
  "REQ-1.22.a.6":
    "(6) if the Contractor is also the Person's social security representative payee or provides Personal Budget Assistance service, an accounting of the Person's personal finances, including their most recent account reconciliations, outstanding balances owed, funds remaining, and benefit information including items as social security, and Supplemental Nutrition Assistance Program (\"SNAP\").",
  "REQ-1.22.b.3":
    "(3) contact information for the behaviorist, social worker, therapist, psychiatrist and any clinician providing support;",
  "REQ-1.22.b.4":
    "(4) contact information for all current health care providers including primary care, neurologist, and dentist;",
  "REQ-1.22.c.1":
    "(1) provide verbal and written notification 30 days prior to the intended discharge date to the Person and the Person's Support Coordinator;",
  "REQ-1.22.c.2":
    "(2) continue to provide services to the Person for up to an additional 90 days after the Contractor initiates the Person's discharge, if directed to by the DSPD Director or designee. If there are concerns regarding the health and safety of the Person or other people, or if there are other considerations, the Contractor may appeal this extension to the DSPD Director; and",
  "REQ-1.22.c.3":
    "(3) submit a discharge summary to the Person's Support Coordinator no later than seven days after the date the Contractor gave notice of discharge.",
  "REQ-1.22.d":
    "(d) The Person may choose to discharge from services with the Contractor at any time. The Contractor shall not require the Person to give prior written or verbal notification of discharge from services. If a Person chooses to discharge from the Contractor's services, the Contractor shall submit a discharge summary to the Person's Support Coordinator at the time of discharge.",
  "REQ-1.23.a":
    "(a) For all services involving Direct Support to Persons, the Contractor shall maintain and document the following in the Person's record:",
  "REQ-1.23.b":
    "(b) If the Contractor supports Persons in their self-directed, self-administration of prescription medication, the Contractor shall have policies and procedures that ensure:",
  "REQ-1.23.c":
    "(c) If the Contractor provides Residential Habilitation Services (\"RHS\"), Professional Parent Supports (\"PPS\"), Host Home Supports (\"HHS\"), Day Supports - Group (\"DSG\"), Day Supports - Partial (\"DSP\"), Day Supports - Individual (\"DSI\"), or Employment Preparation Service (\"EPR\"), or otherwise has primary responsibility for the Person's medication, the Contractor shall ensure that its policies and procedures address the following:",
  "REQ-1.23.d":
    "(d) If the Contractor will support Persons in their self-directed, self-administration of prescription medication, the Contractor shall ensure that the Person's record includes:",
  "REQ-1.23.d.2":
    "(2) instruction regarding routes of administration and dosage for each medication;",
  "REQ-1.23.e":
    "(e) If the Contractor provides RHS, PPS, or HHS, or has primary responsibility for the Person's health care needs, the Contractor shall ensure the Person receives training for and assistance with identifying primary health care professionals within their Medicaid and private insurance, and seeking and obtaining routine and acute medical, dental, psychiatric, or other health related services as specified in the Person's PCSP and covered by the Person's Medicaid or private insurance plan.",
  "REQ-1.23.f.1":
    "(1) ensure that each school, day services provider, and overnight respite agency receives the Person's current relevant health and medical information, and relevant changes; and",
  "REQ-1.23.g.1":
    "(1) ensure relevant health and medical changes that have arisen during services provided are documented in the Person's record, and provided to the other service provider; and",
  "REQ-1.23.h":
    "(h) The Contractor shall maintain and document the following additional health and medical information in the Person's record if it is providing RHS, PPS, HHS, SLH, overnight respite, or if the Contractor is primarily responsible for the Person's medical needs:",
  "REQ-1.28.7.A":
    "(A) notify the Person's Support Coordinator within 24 hours of resolving the emergency and seek the PCPT's approval;",
  "REQ-1.28.7.B":
    "(B) document and maintain a loan record until the loan is paid in full. loan record must include the PCPT's written approval of the loan; reason for the loan; receipts for amount owed; and current accounting of loan including payments and the current balance;",
  "REQ-1.28.7.C":
    "(C) provide the Person's loan record on a monthly basis to the Person, the Person's legal guardian, the Person's Support Coordinator;",
  "REQ-1.28.7.D":
    "(D) provide the Person's loan record to other authorized individuals upon request;",
  "REQ-1.28.7.H":
    "(H) if the Contractor or Support Coordinator no longer provides services to the Person, inform the new Contractor or Support Coordinator of the loan balance. The loan will continue to be part of the DHHS Quality Assurance team annual review for the Contractor where the loan originated until the loan is paid in full; and",
  "REQ-1.28.7.I": "(I) notify the Person when the loan is paid in full.",
  "REQ-1.30.2":
    "(2) prior to Staff providing transportation, the Staff shall be in compliance with the Contractor's driving record policy; have and maintain annually thereafter written documentation of :(A) the transportation Staff's driving record; and (B) their current, valid driver's license; and for Staff providing transportation in their own vehicle, the Staff's current auto insurance that is in compliance with Utah Code Section 31A-22-304 ; and current vehicle registration;",
  "REQ-1.30.3": "(3) ensure Staff providing transportation are trained to ensure that:",
  "REQ-1.30.3.G": "(G) no Persons are left alone to or from their destinations.",
} as const;

type ChildSpec = {
  id: FifteenthExecutableBatchRuleId;
  liveKey: FifteenthExecutableBatchLiveKey;
  section: string;
};

const SPECS: readonly ChildSpec[] = [
  { id: "REQ-1.6.1", liveKey: "volunteer_training_file", section: "1.6(1)" },
  { id: "REQ-1.6.2.B", liveKey: "volunteer_training_file", section: "1.6(2)(B)" },
  { id: "REQ-1.6.3", liveKey: "volunteer_training_file", section: "1.6(3)" },
  { id: "REQ-1.6.3.B", liveKey: "volunteer_training_file", section: "1.6(3)(B)" },
  { id: "REQ-1.6.3.F", liveKey: "volunteer_training_file", section: "1.6(3)(F)" },
  { id: "REQ-1.7.3", liveKey: "medicaid_manuals_memo", section: "1.7(3)" },
  { id: "REQ-1.7.4", liveKey: "medicaid_manuals_memo", section: "1.7(4)" },
  { id: "REQ-1.13.1", liveKey: "medicaid_change_notifications", section: "1.13(1)" },
  { id: "REQ-1.13.3", liveKey: "medicaid_change_notifications", section: "1.13(3)" },
  { id: "REQ-1.13.5", liveKey: "medicaid_disclosure_annual", section: "1.13(5)" },
  { id: "REQ-1.14.1", liveKey: "governing_board_records", section: "1.14(1)" },
  { id: "REQ-1.14.2", liveKey: "governing_board_records", section: "1.14(2)" },
  { id: "REQ-1.14.3", liveKey: "governing_board_records", section: "1.14(3)" },
  { id: "REQ-1.14.4", liveKey: "governing_board_records", section: "1.14(4)" },
  { id: "REQ-1.17.a", liveKey: "personnel_policies", section: "1.17(a)" },
  { id: "REQ-1.17.b", liveKey: "personnel_policies", section: "1.17(b)" },
  { id: "REQ-1.18.2", liveKey: "operating_policies", section: "1.18(2)" },
  { id: "REQ-1.18.5", liveKey: "operating_policies", section: "1.18(5)" },
  { id: "REQ-1.18.7", liveKey: "operating_policies", section: "1.18(7)" },
  { id: "REQ-1.22.a", liveKey: "person_discharge_process", section: "1.22(a)" },
  { id: "REQ-1.22.a.6", liveKey: "person_discharge_process", section: "1.22(a)(6)" },
  { id: "REQ-1.22.b.3", liveKey: "person_discharge_process", section: "1.22(b)(3)" },
  { id: "REQ-1.22.b.4", liveKey: "person_discharge_process", section: "1.22(b)(4)" },
  { id: "REQ-1.22.c.1", liveKey: "person_discharge_process", section: "1.22(c)(1)" },
  { id: "REQ-1.22.c.2", liveKey: "person_discharge_process", section: "1.22(c)(2)" },
  { id: "REQ-1.22.c.3", liveKey: "person_discharge_process", section: "1.22(c)(3)" },
  { id: "REQ-1.22.d", liveKey: "person_discharge_process", section: "1.22(d)" },
  { id: "REQ-1.23.a", liveKey: "health_support_policies", section: "1.23(a)" },
  { id: "REQ-1.23.e", liveKey: "health_support_policies", section: "1.23(e)" },
  { id: "REQ-1.23.f.1", liveKey: "health_support_policies", section: "1.23(f)(1)" },
  { id: "REQ-1.23.g.1", liveKey: "health_support_policies", section: "1.23(g)(1)" },
  { id: "REQ-1.23.b", liveKey: "medication_record", section: "1.23(b)" },
  { id: "REQ-1.23.c", liveKey: "medication_record", section: "1.23(c)" },
  { id: "REQ-1.23.d", liveKey: "medication_record", section: "1.23(d)" },
  { id: "REQ-1.23.d.2", liveKey: "medication_record", section: "1.23(d)(2)" },
  { id: "REQ-1.23.h", liveKey: "medical_dental_exams", section: "1.23(h)" },
  { id: "REQ-1.28.7.A", liveKey: "emergency_loan_record", section: "1.28(7)(A)" },
  { id: "REQ-1.28.7.B", liveKey: "emergency_loan_record", section: "1.28(7)(B)" },
  { id: "REQ-1.28.7.C", liveKey: "emergency_loan_record", section: "1.28(7)(C)" },
  { id: "REQ-1.28.7.D", liveKey: "emergency_loan_record", section: "1.28(7)(D)" },
  { id: "REQ-1.28.7.H", liveKey: "emergency_loan_record", section: "1.28(7)(H)" },
  { id: "REQ-1.28.7.I", liveKey: "emergency_loan_record", section: "1.28(7)(I)" },
  { id: "REQ-1.30.2", liveKey: "driving_record_transport", section: "1.30(2)" },
  { id: "REQ-1.30.3", liveKey: "driving_record_transport", section: "1.30(3)" },
  { id: "REQ-1.30.3.G", liveKey: "driving_record_transport", section: "1.30(3)(G)" },
];

function tests(prefix: string, liveKey: FifteenthExecutableBatchLiveKey): DraftRuleTest[] {
  return [
    {
      id: `${prefix}-t1`,
      kind: "positive",
      assert: `The live ${liveKey} parent file plus the reused applicability predicate greens this leftover child on that card.`,
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
        "Leftover children stay on the existing parent card. Do not invent umbrella REQ-1.17 / REQ-1.9.6. Hold out REQ-1.13.4 and REQ-1.28.6. Do not start MEGA B incidents/HRC or MEGA C service leftovers.",
    },
  ];
}

function fileRule(spec: ChildSpec): DraftRule {
  const family = FAMILIES[spec.liveKey];
  const official = OFFICIAL[spec.id];
  const clause = `SOW §${spec.section}`;
  const predicate: DraftPredicate = {
    kind: family.predicateKind,
    catalogKey: spec.liveKey,
  };
  return {
    id: spec.id,
    version: 1,
    title: family.title,
    catalogKeys: [spec.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource([clause]),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [predicate],
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

export const FIFTEENTH_BATCH_ENGINE_BINDINGS: readonly FifteenthBatchEngineBinding[] = SPECS.map(
  (spec) => {
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
      liveFactKey: family.liveFactKey,
      disposition: family.disposition,
      sharesLiveKeyWith: [...EXISTING_WIRED_PARENTS[spec.liveKey], ...siblingIds],
    };
  },
);

export const FIFTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse the parent applicability facts",
    detail:
      "Volunteer leftovers open only when uses_volunteers is yes. Board leftovers open only when has_governing_board is yes. Transport leftovers follow driving_record_transport. Disclosure follows every employed staff member. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per existing live key",
    detail:
      "Forty-five leftover children collapse onto the thirteen existing pack liveKeys. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Reuse the live-pack file — no generic quiz substitute",
    detail:
      "Official workbook clause_text is the member label. Upload or the live record is the handling path. Do not invent SOW text.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload/record review",
    detail:
      "Submitted files sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. This batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule only",
    detail:
      "Standing files stay keep-current. Disclosure and driving renew on hire anniversary year 1. Manuals stay on the live calendar_year date. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isFifteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isFifteenthExecutableBatchLiveKey(key: string): boolean {
  return (FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function fifteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForFifteenthBatchKey(factKey: FifteenthBatchLiveFactKey): string {
  if (factKey === "uses_volunteers") return "FACT-035";
  if (factKey === "has_governing_board") return "FACT-057";
  if (factKey === "transport_assignment") return "LIVE-transport_assignment";
  if (factKey === "staff_personnel_file") return "LIVE-staff_personnel_file";
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<FifteenthBatchLiveFactKey, string> = {
  uses_volunteers: "Does this contractor use regularly scheduled volunteers?",
  has_governing_board: "Does this contractor have a governing or policy-making board?",
  staff_personnel_file: "Which staff have an active employment record?",
  transport_assignment: "Which staff transport persons?",
  contractor_standing_file: "Is the contractor standing file current?",
};

export function fifteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = FIFTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  if (binding.liveFactKey === "contractor_standing_file") return [];
  return [
    {
      fact_id: liveFactIdForFifteenthBatchKey(binding.liveFactKey),
      question: LIVE_FACT_QUESTIONS[binding.liveFactKey],
    },
  ];
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

export function applyFifteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = fifteenthBatchFixtureFor(rule.id);
  if (!fixture || !isFifteenthExecutableBatchRuleId(rule.id)) return rule;
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
            fifteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applyFifteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyFifteenthExecutableBatchOverlay(rule));
}

export function fifteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isFifteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applyFifteenthExecutableBatchOverlay(rule));
}

export function fifteenthBatchBindingForRule(ruleId: string): FifteenthBatchEngineBinding | null {
  return FIFTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function fifteenthBatchLiveEngineReady(row: FifteenthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isFifteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on existing Article 1 standing liveKeys — do not invent keys.");
  }
  if (
    row.liveFactKey === "staff_personnel_file" &&
    !row.liveKeys.every((key) => (UNIVERSAL_STAFF_KEYS as readonly string[]).includes(key))
  ) {
    reasons.push(`${row.ruleId} staff credential key is not in UNIVERSAL_STAFF_KEYS.`);
  }
  return { ready: reasons.length === 0, reasons };
}

export function fifteenthBatchAssignmentOpensClock(
  liveKey: FifteenthExecutableBatchLiveKey,
  staff: StaffDutyFacts,
  org: {
    uses_volunteers: boolean | null;
    has_governing_board: boolean | null;
  },
): boolean {
  if (liveKey === "volunteer_training_file") return org.uses_volunteers === true;
  if (liveKey === "governing_board_records") return org.has_governing_board === true;
  if (
    liveKey === "driving_record_transport" ||
    (UNIVERSAL_STAFF_KEYS as readonly string[]).includes(liveKey)
  ) {
    return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
  }
  return true;
}

export function fifteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function fifteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isFifteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyFifteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isFifteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function fifteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return FIFTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as FifteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function fifteenthBatchExpectedLiveKey(
  ruleId: FifteenthExecutableBatchRuleId,
): FifteenthExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown fifteenth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function fifteenthBatchOfficialClause(ruleId: FifteenthExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function fifteenthBatchOmitsInventedUmbrellasAndMegaBC(): boolean {
  const keys = FIFTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = FIFTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("volunteer_training_file") &&
    keys.includes("personnel_policies") &&
    keys.includes("medicaid_disclosure_annual") &&
    !keys.includes("incident_reporting_process") &&
    !keys.includes("hrc_committee") &&
    !keys.includes("human_rights_plan") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("fba_bsp") &&
    !rules.includes("REQ-1.17") &&
    !rules.includes("REQ-1.9.6") &&
    !rules.includes("REQ-1.13.4") &&
    !rules.includes("REQ-1.28.6") &&
    !rules.includes("REQ-1.21") &&
    !rules.includes("REQ-1.21.5") &&
    !rules.includes("REQ-1.27") &&
    !rules.includes("REQ-1.35") &&
    !rules.includes("REQ-11.3.5")
  );
}
