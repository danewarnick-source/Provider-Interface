/**
 * Sixteenth shared-behavior executable batch: remaining pack-key-ready
 * leftover children (incidents + HRC + service leftovers).
 *
 * Same leftover-child attach as FY `.c` twins, evac `.6`, and Article 1
 * standing children — wire imported leftover parents onto existing pack
 * liveKeys. Children stay on the parent card. Reuse existing predicates.
 * Official catalog clause_text only — do not invent SOW. Do not invent
 * pack keys. Punch pad stays the incident clock; this batch attaches the
 * written incident-reporting process only. EVV stays CSV only. Staff never
 * touch UPI. Publication stays off until VERIFIED_PUBLICATIONS is filled
 * deliberately.
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
  TimingAnchor,
} from "./draft-rules/types.ts";

export const SIXTEENTH_EXECUTABLE_BATCH_ID = "remaining_pack_key_ready_leftovers" as const;

export const SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "incident_reporting_process",
  "hrc_committee",
  "rights_restriction_record",
  "belongings_inventory",
  "pps_room_board_agreement",
  "pps_foster_license",
  "pba_financial_review",
  "hsq_safe_environment",
  "usor_job_development_sjd",
] as const;

export const SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.27.1",
  "REQ-1.27.1.A",
  "REQ-1.27.1.B",
  "REQ-1.27.2",
  "REQ-1.27.3",
  "REQ-1.27.4",
  "REQ-1.27.5",
  "REQ-1.27.6",
  "REQ-1.20.a",
  "REQ-1.20.b",
  "REQ-1.20.b.6",
  "REQ-1.28.6",
  "REQ-1.33.2",
  "REQ-20.3.5",
  "REQ-21.3.7",
  "REQ-31.3.3",
  "REQ-20.3.9",
  "REQ-20.5.1",
  "REQ-20.5.2",
  "REQ-15.3.1",
  "REQ-15.3.6",
  "REQ-15.3.8",
  "REQ-15.3.9",
  "REQ-15.3.10",
  "REQ-12.4",
  "REQ-33.5.a",
] as const;

export const SIXTEENTH_BATCH_INVENT_BLOCKED_RULE_IDS = [
  "REQ-1.13.4",
  "REQ-1.5",
  "REQ-1.24.7",
  "REQ-1.24.9",
  "REQ-1.4.3",
  "REQ-1.34",
  "REQ-10.5",
] as const;

export type SixteenthExecutableBatchRuleId = (typeof SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type SixteenthExecutableBatchLiveKey =
  (typeof SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type SixteenthBatchLiveFactKey =
  | "contractor_standing_file"
  | "awarded_pps"
  | "awarded_rhs"
  | "awarded_slh"
  | "awarded_pba"
  | "awarded_hsq"
  | "awarded_sjd";

export type SixteenthBatchEngineBinding = {
  ruleId: SixteenthExecutableBatchRuleId;
  liveKeys: readonly SixteenthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment:
    | "contractor_file_reeval"
    | "awarded_service_leftover"
    | "caseload_reeval"
    | "hire_and_assignment_reeval"
    | "org_award_reeval";
  evidence: "upload_file" | "hybrid_record" | "external_then_upload" | "in_platform_review";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review" | "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: SixteenthBatchLiveFactKey;
  awardedCodes: readonly string[];
  factId: string | null;
  disposition: "standing" | "obligation" | "by_design" | "intake";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason: "Standing live-pack file — keep current. Calendar is reminder-only. Do not invent hire+N.",
};

const INTAKE_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Placement on the live standing intake file. Do not invent hire+N or annual-from-completion.",
};

const CERT_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Once; re-verify on printed renewal/expiry. Live cert expiration is the due rule. Do not invent hire+N.",
};

const PBA_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Leftover children stay on the live PBA financial-review card. Do not mint a second 30-day send clock or invent a sample percentage.",
};

const USOR_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Live pack is days after service start 180. Do not invent hire+N or a second USOR cohort.",
};

const HSQ_HIRE: TimingAnchor = { kind: "hire_plus_days", days: 0 };

const EXISTING_WIRED_PARENTS: Readonly<
  Record<SixteenthExecutableBatchLiveKey, readonly string[]>
> = {
  incident_reporting_process: [],
  hrc_committee: [],
  rights_restriction_record: [],
  belongings_inventory: ["REQ-11.3.5"],
  pps_room_board_agreement: [],
  pps_foster_license: [],
  pba_financial_review: ["REQ-1.28.5", "REQ-15.3.7"],
  hsq_safe_environment: [],
  usor_job_development_sjd: [],
};

type FamilyMeta = {
  title: string;
  predicateKind: "contractor_standing_file" | "awarded_service_codes" | "pba_assignment";
  timing: TimingAnchor;
  routes: CompletionRoute[];
  handling: string;
  assignment: SixteenthBatchEngineBinding["assignment"];
  evidence: SixteenthBatchEngineBinding["evidence"];
  adminReview: SixteenthBatchEngineBinding["adminReview"];
  liveFactKey: SixteenthBatchLiveFactKey;
  disposition: SixteenthBatchEngineBinding["disposition"];
};

const FAMILIES: Readonly<Record<SixteenthExecutableBatchLiveKey, FamilyMeta>> = {
  incident_reporting_process: {
    title: "Incident Reporting Process",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["UPLOAD"],
    handling:
      "Upload of the written incident reporting process is the handling path. The live punch pad stays the incident clock. Do not mint a second incidents clock. Staff never touch UPI. EVV stays CSV only.",
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "contractor_standing_file",
    disposition: "standing",
  },
  hrc_committee: {
    title: "Human Rights Committee — Established and Meeting",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "The live HRC roster, meetings, and attendance is the handling path, not a second calendar to-do.",
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "contractor_standing_file",
    disposition: "by_design",
  },
  rights_restriction_record: {
    title: "Human-Rights Restriction Record",
    predicateKind: "contractor_standing_file",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling:
      "The live human-rights restriction record is the handling path. N/A when there is no modification.",
    assignment: "contractor_file_reeval",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "contractor_standing_file",
    disposition: "by_design",
  },
  belongings_inventory: {
    title: "Belongings Inventory — Annual",
    predicateKind: "awarded_service_codes",
    timing: STANDING_NONE,
    routes: ["IN_PLATFORM"],
    handling: "The live belongings register is the handling path, not a second annual form.",
    assignment: "awarded_service_leftover",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "awarded_pps",
    disposition: "by_design",
  },
  pps_room_board_agreement: {
    title: "PPS Room-and-Board Agreement",
    predicateKind: "awarded_service_codes",
    timing: INTAKE_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling: "The live room-and-board form or uploaded agreement is the handling path.",
    assignment: "awarded_service_leftover",
    evidence: "hybrid_record",
    adminReview: "record_review",
    liveFactKey: "awarded_pps",
    disposition: "intake",
  },
  pps_foster_license: {
    title: "Child Placing / Foster Care License (DHHS/OL) — PPS",
    predicateKind: "awarded_service_codes",
    timing: CERT_NONE,
    routes: ["EXTERNAL", "UPLOAD"],
    handling: "External OL foster license plus uploaded confirmation is the handling path.",
    assignment: "awarded_service_leftover",
    evidence: "external_then_upload",
    adminReview: "upload_review",
    liveFactKey: "awarded_pps",
    disposition: "obligation",
  },
  pba_financial_review: {
    title: "PBA / Representative-Payee Financial Review",
    predicateKind: "pba_assignment",
    timing: PBA_NONE,
    routes: ["IN_PLATFORM", "UPLOAD"],
    handling:
      "The live PBA financial-review record is the handling path. Leftover children stay on that card. Do not mint a second 30-day send clock.",
    assignment: "caseload_reeval",
    evidence: "in_platform_review",
    adminReview: "record_review",
    liveFactKey: "awarded_pba",
    disposition: "by_design",
  },
  hsq_safe_environment: {
    title: "HSQ — Clean, Sanitary & Safe Environment Training",
    predicateKind: "awarded_service_codes",
    timing: HSQ_HIRE,
    routes: ["UPLOAD"],
    handling: "Upload of the HSQ safe-environment training record is the handling path.",
    assignment: "hire_and_assignment_reeval",
    evidence: "upload_file",
    adminReview: "upload_review",
    liveFactKey: "awarded_hsq",
    disposition: "obligation",
  },
  usor_job_development_sjd: {
    title: "USOR Approved Vendor — Job Development (SJD)",
    predicateKind: "awarded_service_codes",
    timing: USOR_NONE,
    routes: ["EXTERNAL", "UPLOAD"],
    handling:
      "Upload of the official USOR approved-vendor proof is the handling path. PI stores the upload; it does not send the email. Staff never touch UPI.",
    assignment: "org_award_reeval",
    evidence: "external_then_upload",
    adminReview: "upload_review",
    liveFactKey: "awarded_sjd",
    disposition: "obligation",
  },
};

const OFFICIAL = {
  "REQ-1.27.1":
    "(1) within 24 hours from discovery of an incident requiring an incident report:",
  "REQ-1.27.1.A":
    "(A) initiate an incident report entry into UPI. This UPI entry will automatically notify the Person's Support Coordinator; and",
  "REQ-1.27.1.B":
    "(B) notify the Person's guardian by telephone, email, or face to face contact.",
  "REQ-1.27.2":
    "(2) within five Business Days from discovery of the incident, the Contractor shall complete the detailed incident report in UPI, include any additional information available, and report mitigating or follow up actions taken;",
  "REQ-1.27.3":
    "(3) with incidents of actual or suspected abuse, neglect, exploitation, or maltreatment of Persons, document on the incident report in UPI that prevention strategies have been or will be developed and implemented when applicable;",
  "REQ-1.27.4":
    "(4) submit an incident report into UPI per the DHHS Critical Incident Reporting Guide found on the Division of Licensing and Background Checks webpage;",
  "REQ-1.27.5":
    "(5) ensure they respond to the Person's Support Coordinator's request for additional information regarding any incident, in writing, within five Business Days of the request; and",
  "REQ-1.27.6":
    "(6) ensure support of any investigation and mitigation activities taken by DHHS, or the Person's Support Coordinator by providing any additional information requested, cooperating with any requests regarding incidents.",
  "REQ-1.20.a":
    "(a) The Contractor shall establish a human rights committee that is in compliance with rule Utah Administrative Code R539-3-4.",
  "REQ-1.20.b":
    "(b) The Human Rights Committee will determine and document approval or denial of a Person's human rights modifications. The process for implementing a human rights modification must be Person-Centered. The following are requirements that must be included in the documentation:",
  "REQ-1.20.b.6":
    "(6) established time limits for periodic reviews to determine if the modification is still necessary or can be terminated;",
  "REQ-1.28.6":
    "(6) attain written approval from its Human Rights Committee and the Person's Support Coordinator prior to placing any modifications on the Person's access or allowable spending limits;",
  "REQ-1.33.2":
    "(2) ensure rights modifications are approved for a Person when two Staff to one Person (2:1) ratio is documented as a need in their DSPD Worksheet.",
  "REQ-20.3.5":
    "(5) create an inventory of the Person's belongings. The inventory must be maintained in the Person's file and include written documentation of the following:",
  "REQ-21.3.7":
    "(7) create an inventory of the Person's belongings. The inventory must be maintained in the Person's file and include written documentation of the following:",
  "REQ-31.3.3":
    "(3) create an inventory of the Person's belongings. The inventory must be maintained in the Person's file and include written documentation of the following:",
  "REQ-20.3.9": "(9) maintain a current room and board agreement with the Person's legal guardian;",
  "REQ-20.5.1":
    "(1) have and maintain a current OL Child Placing Foster license as detailed in Utah Administrative Code, Rule R501-12; and",
  "REQ-20.5.2": "(2) comply with OL Foster Care Services rules.",
  "REQ-15.3.1":
    "(1) develop policies and procedures that ensure established practices do not jeopardize the Person's eligibility for services, that there are provisions for coordination and cooperation with an eligibility worker when necessary to assure services meet eligibility requirements, and there are provisions for lost receipts;",
  "REQ-15.3.6":
    "(6) maintain a current financial record for each Person and allow for an external review by authorized entities and validation of the financial records. Each Person must have a financial record that includes and clearly documents the following: deposits, withdraws and transfers; interest and debts; current account balances; reconciled financial statements; receipts or monthly bank statements to verify all expenditures; receipts for purchases over $50.00 or for multiple items purchased together with a value greater than $50.00; documentation of any items purchased by splitting the cost with any other Person; cash records; and any financial records pertaining to the Person;",
  "REQ-15.3.8":
    "(8) provide the Person's Support Coordinator with the Person's financial report no later than 30 Calendar Days following the end of the month they are issued. If requested, provide the Person's guardian with the Person's financial report no later than 30 days following the request date;",
  "REQ-15.3.9":
    "(9) provide a complete, current accounting of the Person's funds to the new Contractor or Representative Payee if the Person changes contractors or selects a different Representative Payee. Ensure that all financial matters are resolved and all remaining funds and accounts are appropriately transferred or closed;",
  "REQ-15.3.10":
    "(10) upon a Person's death, return any unused Social Security funds to the SSA as required by policy. Transfer any remaining funds to the legal representative of the Person's estate, along with a complete and current accounting of the Person's financial status within 90 Calendar Days of death; and",
  "REQ-12.4":
    "12.4 Specific Service Training Requirements. The Contractor shall ensure HSQ Staff are trained on maintaining a clean, sanitary, and safe living environment prior to providing HSQ services. The Contractor shall maintain documentation of HSQ training in the Staff's file.",
  "REQ-33.5.a":
    "(a) The Contractor shall be an approved vendor with USOR within 6 months of having a contract with DHHS/DSPD for SJB services and submit proof to the DHHS Office of Service review via osrprovider@utah.gov.",
} as const;

type ChildSpec = {
  id: SixteenthExecutableBatchRuleId;
  liveKey: SixteenthExecutableBatchLiveKey;
  section: string;
  codes?: readonly string[];
  factId?: string;
  question?: string;
  liveFactKey?: SixteenthBatchLiveFactKey;
};

const SPECS: readonly ChildSpec[] = [
  { id: "REQ-1.27.1", liveKey: "incident_reporting_process", section: "1.27(1)" },
  { id: "REQ-1.27.1.A", liveKey: "incident_reporting_process", section: "1.27(1)(A)" },
  { id: "REQ-1.27.1.B", liveKey: "incident_reporting_process", section: "1.27(1)(B)" },
  { id: "REQ-1.27.2", liveKey: "incident_reporting_process", section: "1.27(2)" },
  { id: "REQ-1.27.3", liveKey: "incident_reporting_process", section: "1.27(3)" },
  { id: "REQ-1.27.4", liveKey: "incident_reporting_process", section: "1.27(4)" },
  { id: "REQ-1.27.5", liveKey: "incident_reporting_process", section: "1.27(5)" },
  { id: "REQ-1.27.6", liveKey: "incident_reporting_process", section: "1.27(6)" },
  { id: "REQ-1.20.a", liveKey: "hrc_committee", section: "1.20(a)" },
  { id: "REQ-1.20.b", liveKey: "rights_restriction_record", section: "1.20(b)" },
  { id: "REQ-1.20.b.6", liveKey: "rights_restriction_record", section: "1.20(b)(6)" },
  { id: "REQ-1.28.6", liveKey: "rights_restriction_record", section: "1.28(6)" },
  { id: "REQ-1.33.2", liveKey: "rights_restriction_record", section: "1.33(2)" },
  {
    id: "REQ-20.3.5",
    liveKey: "belongings_inventory",
    section: "20.3(5)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
    liveFactKey: "awarded_pps",
  },
  {
    id: "REQ-21.3.7",
    liveKey: "belongings_inventory",
    section: "21.3(7)",
    codes: ["RHS"],
    factId: "FACT-007",
    question: "Agency awarded RHS?",
    liveFactKey: "awarded_rhs",
  },
  {
    id: "REQ-31.3.3",
    liveKey: "belongings_inventory",
    section: "31.3(3)",
    codes: ["SLH"],
    factId: "FACT-034",
    question: "Agency awarded SLH?",
    liveFactKey: "awarded_slh",
  },
  {
    id: "REQ-20.3.9",
    liveKey: "pps_room_board_agreement",
    section: "20.3(9)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
  },
  {
    id: "REQ-20.5.1",
    liveKey: "pps_foster_license",
    section: "20.5(1)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
  },
  {
    id: "REQ-20.5.2",
    liveKey: "pps_foster_license",
    section: "20.5(2)",
    codes: ["PPS"],
    factId: "FACT-001",
    question: "Agency awarded PPS?",
  },
  {
    id: "REQ-15.3.1",
    liveKey: "pba_financial_review",
    section: "15.3(1)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
  },
  {
    id: "REQ-15.3.6",
    liveKey: "pba_financial_review",
    section: "15.3(6)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
  },
  {
    id: "REQ-15.3.8",
    liveKey: "pba_financial_review",
    section: "15.3(8)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
  },
  {
    id: "REQ-15.3.9",
    liveKey: "pba_financial_review",
    section: "15.3(9)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
  },
  {
    id: "REQ-15.3.10",
    liveKey: "pba_financial_review",
    section: "15.3(10)",
    codes: ["PBA"],
    factId: "FACT-005",
    question: "Agency awarded PBA?",
  },
  {
    id: "REQ-12.4",
    liveKey: "hsq_safe_environment",
    section: "12.4",
    codes: ["HSQ"],
    factId: "FACT-045",
    question: "Agency awarded HSQ?",
  },
  {
    id: "REQ-33.5.a",
    liveKey: "usor_job_development_sjd",
    section: "33.5(a)",
    codes: ["SJD"],
    factId: "FACT-002",
    question: "Agency awarded SJD?",
  },
];

function tests(prefix: string, liveKey: SixteenthExecutableBatchLiveKey): DraftRuleTest[] {
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
        "Leftover children stay on the existing parent card. Do not invent pack keys or SOW text. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only. Do not invent medicaid-eligibility, DOPL-exemption, PN1/PN2 monthly, Form 929, or UPI employee-registry keys.",
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
  if (family.predicateKind === "pba_assignment") {
    return { kind: "pba_assignment", catalogKey: spec.liveKey };
  }
  return { kind: family.predicateKind, catalogKey: spec.liveKey };
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

export const SIXTEENTH_BATCH_ENGINE_BINDINGS: readonly SixteenthBatchEngineBinding[] = SPECS.map(
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
      liveFactKey: spec.liveFactKey ?? family.liveFactKey,
      awardedCodes: spec.codes ?? [],
      factId: spec.factId ?? null,
      disposition: family.disposition,
      sharesLiveKeyWith: [...EXISTING_WIRED_PARENTS[spec.liveKey], ...siblingIds],
    };
  },
);

export const SIXTEENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Reuse the parent applicability facts",
    detail:
      "Incident, HRC, and restriction leftovers open on the standing / live-module cards. Belongings, PPS room-and-board, foster license, HSQ, and USOR leftovers follow awarded codes. PBA leftovers follow the live PBA assignment. Empty facts stay questions — never silent N/A.",
  },
  {
    step: "task",
    title: "One parent card per existing live key",
    detail:
      "Twenty-six leftover children collapse onto the nine existing pack liveKeys. Child items stay on the parent. Punch pad stays the incident clock. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Reuse the live-pack file — no generic quiz substitute",
    detail:
      "Official workbook clause_text is the member label. Upload or the live record is the handling path. Do not invent SOW text. Staff never touch UPI. EVV stays CSV only.",
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
      "Standing and by-design files stay keep-current. HSQ renews on hire plus 0. Foster license follows printed expiry. USOR follows the live 180-day pack rule. Do not invent hire+N or annual-from-completion.",
  },
] as const;

export function isSixteenthExecutableBatchRuleId(ruleId: string): boolean {
  return (SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isSixteenthExecutableBatchLiveKey(key: string): boolean {
  return (SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function sixteenthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

const AWARDED_FACT_QUESTIONS: Record<
  Exclude<SixteenthBatchLiveFactKey, "contractor_standing_file">,
  { factId: string; question: string }
> = {
  awarded_pps: { factId: "FACT-001", question: "Agency awarded PPS?" },
  awarded_rhs: { factId: "FACT-007", question: "Agency awarded RHS?" },
  awarded_slh: { factId: "FACT-034", question: "Agency awarded SLH?" },
  awarded_pba: { factId: "FACT-005", question: "Agency awarded PBA?" },
  awarded_hsq: { factId: "FACT-045", question: "Agency awarded HSQ?" },
  awarded_sjd: { factId: "FACT-002", question: "Agency awarded SJD?" },
};

export function sixteenthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = SIXTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding || binding.liveFactKey === "contractor_standing_file") return [];
  const spec = SPECS.find((row) => row.id === ruleId);
  if (spec?.factId && spec.question) {
    return [{ fact_id: spec.factId, question: spec.question }];
  }
  const fact = AWARDED_FACT_QUESTIONS[binding.liveFactKey];
  return [{ fact_id: fact.factId, question: fact.question }];
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

export function applySixteenthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = sixteenthBatchFixtureFor(rule.id);
  if (!fixture || !isSixteenthExecutableBatchRuleId(rule.id)) return rule;
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
            sixteenthBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applySixteenthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applySixteenthExecutableBatchOverlay(rule));
}

export function sixteenthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isSixteenthExecutableBatchRuleId(rule.id))
    .map((rule) => applySixteenthExecutableBatchOverlay(rule));
}

export function sixteenthBatchBindingForRule(ruleId: string): SixteenthBatchEngineBinding | null {
  return SIXTEENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function sixteenthBatchLiveEngineReady(row: SixteenthBatchEngineBinding): {
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
  if (row.liveKeys.length !== 1 || !isSixteenthExecutableBatchLiveKey(row.liveKeys[0] ?? "")) {
    reasons.push("Parents must stay on existing pack liveKeys — do not invent keys.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function sixteenthBatchAssignmentOpensClock(
  liveKey: SixteenthExecutableBatchLiveKey,
  orgFacts: OrgFacts | null = null,
  awardedCodes?: readonly string[],
): boolean {
  if (
    liveKey === "incident_reporting_process" ||
    liveKey === "hrc_committee" ||
    liveKey === "rights_restriction_record"
  ) {
    return true;
  }
  const codes =
    awardedCodes ??
    (liveKey === "pba_financial_review"
      ? ["PBA"]
      : sowCatalogEntryByKey(liveKey)?.service_codes ?? []);
  return awardedCodeDutyStatus([...codes], orgFacts?.servicesOffered ?? []) === "applies";
}

export function sixteenthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function sixteenthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isSixteenthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applySixteenthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isSixteenthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function sixteenthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return SIXTEENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as SixteenthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function sixteenthBatchExpectedLiveKey(
  ruleId: SixteenthExecutableBatchRuleId,
): SixteenthExecutableBatchLiveKey {
  const spec = SPECS.find((row) => row.id === ruleId);
  if (!spec) throw new Error(`Unknown sixteenth-batch rule ${ruleId}`);
  return spec.liveKey;
}

export function sixteenthBatchOfficialClause(ruleId: SixteenthExecutableBatchRuleId): string {
  return OFFICIAL[ruleId];
}

export function sixteenthBatchOmitsInventedKeysAndBlockedFamilies(): boolean {
  const keys = SIXTEENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = SIXTEENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    keys.includes("incident_reporting_process") &&
    keys.includes("hrc_committee") &&
    keys.includes("rights_restriction_record") &&
    keys.includes("belongings_inventory") &&
    keys.includes("pps_room_board_agreement") &&
    keys.includes("pps_foster_license") &&
    keys.includes("pba_financial_review") &&
    keys.includes("hsq_safe_environment") &&
    keys.includes("usor_job_development_sjd") &&
    !keys.includes("client_specific_training") &&
    !keys.includes("iqmp") &&
    !keys.includes("epr_community_20pct") &&
    !rules.includes("REQ-1.13.4") &&
    !rules.includes("REQ-1.5") &&
    !rules.includes("REQ-1.24.7") &&
    !rules.includes("REQ-1.24.9") &&
    !rules.includes("REQ-1.4.3") &&
    !rules.includes("REQ-1.34") &&
    !rules.includes("REQ-10.5") &&
    !rules.includes("REQ-3.4.3") &&
    !rules.includes("REQ-33.2.a") &&
    !rules.includes("REQ-30.8.1") &&
    !rules.includes("REQ-23.3.1")
  );
}
