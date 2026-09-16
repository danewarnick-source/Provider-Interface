/**
 * Ninth shared-behavior executable batch: Article 1.15 UPI / USTEPS ops
 * parents (REQ-1.15.1–REQ-1.15.15).
 *
 * Extends the live pack next to usteps_upi_accounts (REQ-1.4.2). New upi_*
 * keys are one parent card each. Staff never touch UPI. Timing copies the
 * official workbook deadline or an explicit none — no invented hire+N,
 * annual-from-completion, PN1/PN2, quarterly evac, or annual-outcome keys.
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
 */

import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
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

export const NINTH_EXECUTABLE_BATCH_ID = "article1_upi_usteps_ops" as const;

/** Imported catalog parents this batch overlays. */
export const NINTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.15.1",
  "REQ-1.15.2",
  "REQ-1.15.3",
  "REQ-1.15.4",
  "REQ-1.15.5",
  "REQ-1.15.6",
  "REQ-1.15.7",
  "REQ-1.15.8",
  "REQ-1.15.9",
  "REQ-1.15.10",
  "REQ-1.15.11",
  "REQ-1.15.12",
  "REQ-1.15.13",
  "REQ-1.15.14",
  "REQ-1.15.15",
] as const;

export const NINTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "upi_form_0_9_designee",
  "upi_form_0_8_user",
  "upi_need_to_know_access",
  "upi_1056_decision",
  "upi_1056_reject_coordinate",
  "upi_1056_utilization",
  "upi_provider_organization",
  "upi_staff_org_groups",
  "upi_staff_notify_prefs",
  "upi_person_org_groups",
  "upi_remove_terminated_staff",
  "upi_remove_staff_need_to_know",
  "upi_remove_discharged_person",
  "upi_annual_access_review",
  "upi_notify_usteps_termination",
] as const;

export type NinthExecutableBatchRuleId = (typeof NINTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type NinthExecutableBatchLiveKey = (typeof NINTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type NinthBatchLiveFactKey = "contractor_upi_file" | "upi_access_staff" | "authorization_1056";

export type NinthBatchEngineBinding = {
  ruleId: NinthExecutableBatchRuleId;
  liveKeys: readonly NinthExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "contractor_file_reeval";
  evidence: "external_then_upload" | "upload_file" | "system_check";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review" | "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: NinthBatchLiveFactKey;
  disposition: "standing" | "by_design";
  sharesLiveKeyWith: readonly string[];
};

const NO_EQUIV = false as const;

function tests(prefix: string, rows: Array<[DraftRuleTest["kind"], string]>): DraftRuleTest[] {
  return rows.map(([kind, assert], i) => ({
    id: `${prefix}-t${i + 1}`,
    kind,
    assert,
  }));
}

function fileRule(input: {
  id: NinthExecutableBatchRuleId;
  title: string;
  liveKey: NinthExecutableBatchLiveKey;
  clauses: string[];
  predicate: DraftPredicate;
  timing: TimingAnchor;
  summary: string;
  routes: CompletionRoute[];
  handling: string;
  memberLabel: string;
  tests: Array<[DraftRuleTest["kind"], string]>;
}): DraftRule {
  return {
    id: input.id,
    version: 1,
    title: input.title,
    catalogKeys: [input.liveKey],
    lifecycle: "draft",
    publication: "not_published",
    source: linkWorkbookSource(input.clauses),
    sourceIndex: WORKBOOK_SOURCE_INDEX,
    predicates: [input.predicate],
    group: {
      logic: "ALL",
      parentAssignment: "one",
      members: [
        {
          id: `${input.id}-file`,
          label: input.memberLabel,
          sourceClauseId: input.clauses[0] ?? input.id,
          catalogKey: input.liveKey,
          completionRoutes: input.routes,
        },
      ],
    },
    timing: input.timing,
    evidence: {
      summary: input.summary,
      routes: input.routes,
      defaultHandlingLabel: input.handling,
      automaticEquivalency: NO_EQUIV,
    },
    completionRoutes: input.routes,
    tests: tests(input.id, input.tests),
    unresolvedAlternatives: [],
    unresolvedRenewals: [],
    releaseGaps: [],
    publicationGap: null,
    approval: null,
  };
}

const STANDING_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Timing is missing-information. Standing UPI/USTEPS ops file — keep current. Do not invent hire+N or annual-from-completion.",
};

const DAYS_15_1056: TimingAnchor = {
  kind: "none",
  reason:
    "Official workbook deadline: 15 calendar days from new or adjusted 1056 created in UPI. Do not invent hire+N.",
};

const REJECT_1056: TimingAnchor = {
  kind: "none",
  reason: "Official workbook trigger: 1056 rejected. New instance each rejection. Do not invent hire+N.",
};

const UTILIZATION_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Official workbook trigger: units used approach 1056 allocation / per claim / continuous check. System path — do not invent hire+N.",
};

const ONE_DAY_TERMINATION: TimingAnchor = {
  kind: "none",
  reason:
    "Official workbook deadline: 1 calendar day from staff termination / no longer needs access. Do not invent hire+N.",
};

const ONE_DAY_UPI_TERMINATION: TimingAnchor = {
  kind: "none",
  reason:
    "Official workbook deadline: 1 calendar day from termination of staff with UPI access. Do not invent hire+N.",
};

const ANNUAL_ANCHOR_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Workbook recurrence is annual; annual anchor is missing-information. Do not invent employment-year, fiscal-year, or annual-from-completion.",
};

const CONTRACTOR_PRED = (key: NinthExecutableBatchLiveKey): DraftPredicate => ({
  kind: "contractor_standing_file",
  catalogKey: key,
});

const CHANGE_PRED = (key: NinthExecutableBatchLiveKey): DraftPredicate => ({
  kind: "change_impact",
  catalogKey: key,
});

const BILLING_PRED = (key: NinthExecutableBatchLiveKey): DraftPredicate => ({
  kind: "billing_restriction",
  catalogKey: key,
});

export const REQ_1_15_1_FORM_0_9: DraftRule = fileRule({
  id: "REQ-1.15.1",
  title: "UPI Form 0-9 — Provider Company Designee Access",
  liveKey: "upi_form_0_9_designee",
  clauses: ["SOW §1.15(1)"],
  predicate: CONTRACTOR_PRED("upi_form_0_9_designee"),
  timing: STANDING_NONE,
  summary:
    "Complete DSPD form \"0-9 USTEPS Provider Interface (UPI) Provider Company Designee Access Form\" on upi_form_0_9_designee. Adjacent to usteps_upi_accounts — not a second contractor-account clock. Staff never touch UPI.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External 0-9 form plus uploaded confirmation is the handling path.",
  memberLabel: "DSPD form 0-9 USTEPS Provider Interface (UPI) Provider Company Designee Access Form",
  tests: [
    ["positive", "A completed 0-9 designee form with uploaded confirmation satisfies the parent."],
    ["negative", "A generic attestation without the 0-9 form leaves the parent incomplete."],
    ["boundary", "This parent does not absorb REQ-1.4.2 usteps_upi_accounts or invent hire+N."],
  ],
});

export const REQ_1_15_2_FORM_0_8: DraftRule = fileRule({
  id: "REQ-1.15.2",
  title: "UPI Form 0-8 — Individual User Access",
  liveKey: "upi_form_0_8_user",
  clauses: ["SOW §1.15(2)"],
  predicate: CONTRACTOR_PRED("upi_form_0_8_user"),
  timing: STANDING_NONE,
  summary:
    "Complete DSPD form \"0-8 USTEPS Provider Interface (UPI) Individual User Access Form\" for at least one Staff on upi_form_0_8_user. Which staff hold UPI access stays a question. Staff never touch UPI.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External 0-8 form for at least one Staff plus uploaded confirmation is the handling path.",
  memberLabel: "DSPD form 0-8 USTEPS Provider Interface (UPI) Individual User Access Form",
  tests: [
    ["positive", "At least one completed 0-8 individual user form satisfies the parent."],
    ["negative", "Zero 0-8 forms leaves the parent incomplete."],
    ["boundary", "Which staff hold UPI access unanswered stays a question — never silent N/A."],
  ],
});

export const REQ_1_15_3_NEED_TO_KNOW: DraftRule = fileRule({
  id: "REQ-1.15.3",
  title: "UPI Need-to-Know Access",
  liveKey: "upi_need_to_know_access",
  clauses: ["SOW §1.15(3)"],
  predicate: CONTRACTOR_PRED("upi_need_to_know_access"),
  timing: STANDING_NONE,
  summary:
    "Ensure that access to UPI is granted only to Staff that need to know the information in UPI to provide professional treatment or coordinate DSPD services.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI access roster limited to need-to-know staff is the handling path.",
  memberLabel: "UPI access granted only to Staff that need to know",
  tests: [
    ["positive", "A current need-to-know UPI access roster satisfies the parent."],
    ["negative", "UPI access granted to staff without a need to know leaves the parent incomplete."],
    ["boundary", "Which staff hold UPI access unanswered stays a question — never silent N/A."],
  ],
});

export const REQ_1_15_4_1056_DECISION: DraftRule = fileRule({
  id: "REQ-1.15.4",
  title: "UPI 1056 Approve or Reject",
  liveKey: "upi_1056_decision",
  clauses: ["SOW §1.15(4)"],
  predicate: CHANGE_PRED("upi_1056_decision"),
  timing: DAYS_15_1056,
  summary:
    "Approve or reject the DSPD Service Authorization Form 1056 (\"1056\") through UPI within 15 Calendar Days of the creation of a new or adjusted 1056. Record the UPI decision in the platform. No authorization → no shift, no billing.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI 1056 decision plus uploaded confirmation is the handling path.",
  memberLabel: "Approve or reject the 1056 through UPI within 15 Calendar Days",
  tests: [
    ["positive", "A recorded UPI approve or reject within 15 calendar days of a new or adjusted 1056 satisfies the parent."],
    ["negative", "An unrecorded 1056 decision after the 15-day workbook deadline leaves the parent incomplete."],
    ["boundary", "Do not invent hire+N. New instance each new or adjusted 1056. This is not usteps_upi_accounts."],
  ],
});

export const REQ_1_15_5_1056_REJECT: DraftRule = fileRule({
  id: "REQ-1.15.5",
  title: "UPI 1056 Rejection — Support Coordinator Coordination",
  liveKey: "upi_1056_reject_coordinate",
  clauses: ["SOW §1.15(5)"],
  predicate: CHANGE_PRED("upi_1056_reject_coordinate"),
  timing: REJECT_1056,
  summary:
    "If the Contractor rejects the 1056, coordinate with the Person's Support Coordinator to either adjust the 1056, or start the process to discharge the Person from receiving Contractor's services and transition to a different contractor.",
  routes: ["UPLOAD"],
  handling: "Uploaded proof of Support Coordinator coordination after a 1056 rejection is the handling path.",
  memberLabel: "Coordinate with the Support Coordinator after a 1056 rejection",
  tests: [
    ["positive", "Documented Support Coordinator coordination after a 1056 rejection satisfies the parent."],
    ["negative", "A 1056 rejection without Support Coordinator coordination leaves the parent incomplete."],
    ["boundary", "Opens only on 1056 rejected — not on an approval. Do not absorb person_discharge_process."],
  ],
});

export const REQ_1_15_6_UTILIZATION: DraftRule = fileRule({
  id: "REQ-1.15.6",
  title: "UPI 1056 Utilization Monitor",
  liveKey: "upi_1056_utilization",
  clauses: ["SOW §1.15(6)"],
  predicate: BILLING_PRED("upi_1056_utilization"),
  timing: UTILIZATION_NONE,
  summary:
    "Monitor the use of services by the Person to ensure that the utilization of services complies with the approved 1056. If the Person is at risk of exhausting the units allocated in the 1056, notify the Person's Support Coordinator and arrange for appropriate changes to the Person's PCSP. Live remaining-units path — not a second checklist.",
  routes: ["SYSTEM"],
  handling: "Automated remaining-units check is the handling path, not a staff UPI-entry clock.",
  memberLabel: "Utilization complies with the approved 1056; notify Support Coordinator near exhaustion",
  tests: [
    ["positive", "A remaining-units check that utilization complies with the approved 1056 satisfies the parent."],
    ["negative", "Units approaching the 1056 allocation without a Support Coordinator notice leaves the parent incomplete."],
    ["boundary", "Continuous / per-claim check. Do not invent hire+N or a second billing checklist."],
  ],
});

export const REQ_1_15_7_PROVIDER_ORG: DraftRule = fileRule({
  id: "REQ-1.15.7",
  title: "UPI Provider Organization Structure",
  liveKey: "upi_provider_organization",
  clauses: ["SOW §1.15(7)"],
  predicate: CONTRACTOR_PRED("upi_provider_organization"),
  timing: STANDING_NONE,
  summary:
    "Use the UPI \"Provider Organization\" section to create and maintain a Contractor organizational group structure that will restrict UPI users from seeing Person information not required to provide professional treatment or coordinate DSPD services.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI Provider Organization structure plus uploaded confirmation is the handling path.",
  memberLabel: "UPI Provider Organization group structure that restricts need-to-know visibility",
  tests: [
    ["positive", "A current UPI Provider Organization group structure satisfies the parent."],
    ["negative", "A missing Provider Organization structure leaves the parent incomplete."],
    ["boundary", "This parent does not mint per-staff UPI-entry clocks."],
  ],
});

export const REQ_1_15_8_STAFF_GROUPS: DraftRule = fileRule({
  id: "REQ-1.15.8",
  title: "UPI Staff Organizational Groups",
  liveKey: "upi_staff_org_groups",
  clauses: ["SOW §1.15(8)"],
  predicate: CONTRACTOR_PRED("upi_staff_org_groups"),
  timing: STANDING_NONE,
  summary:
    "Assign and maintain Staff with UPI access to the appropriate organizational groups. Admin-only parent — staff never touch UPI. Which staff hold UPI access stays a question.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI staff-to-group assignment plus uploaded confirmation is the handling path.",
  memberLabel: "Staff with UPI access assigned to the appropriate organizational groups",
  tests: [
    ["positive", "Each UPI-access staff member assigned to the correct organizational group satisfies the parent."],
    ["negative", "A UPI-access staff member missing an organizational group leaves the parent incomplete."],
    ["boundary", "Which staff hold UPI access unanswered stays a question. Staff never complete this parent."],
  ],
});

export const REQ_1_15_9_STAFF_NOTIFY: DraftRule = fileRule({
  id: "REQ-1.15.9",
  title: "UPI Staff Email and Notification Preference",
  liveKey: "upi_staff_notify_prefs",
  clauses: ["SOW §1.15(9)"],
  predicate: CONTRACTOR_PRED("upi_staff_notify_prefs"),
  timing: STANDING_NONE,
  summary:
    "Assign and maintain each Staff with UPI access, email, and notification preference. Admin-only parent — staff never touch UPI.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI email and notification preference plus uploaded confirmation is the handling path.",
  memberLabel: "Each Staff with UPI access has email and notification preference",
  tests: [
    ["positive", "Current UPI email and notification preference for each UPI-access staff member satisfies the parent."],
    ["negative", "A UPI-access staff member missing email or notification preference leaves the parent incomplete."],
    ["boundary", "Which staff hold UPI access unanswered stays a question — never silent N/A."],
  ],
});

export const REQ_1_15_10_PERSON_GROUPS: DraftRule = fileRule({
  id: "REQ-1.15.10",
  title: "UPI Person Organizational Groups",
  liveKey: "upi_person_org_groups",
  clauses: ["SOW §1.15(10)"],
  predicate: CONTRACTOR_PRED("upi_person_org_groups"),
  timing: STANDING_NONE,
  summary:
    "Assign and maintain each Person to the appropriate organizational groups in UPI. Record completion in the platform.",
  routes: ["UPLOAD"],
  handling: "Uploaded confirmation that each Person is in the appropriate UPI organizational group is the handling path.",
  memberLabel: "Each Person assigned to the appropriate organizational groups",
  tests: [
    ["positive", "Each Person assigned to the appropriate UPI organizational group satisfies the parent."],
    ["negative", "A Person missing a UPI organizational group leaves the parent incomplete."],
    ["boundary", "Do not mint a per-Person staff task. Admin records completion on this parent."],
  ],
});

export const REQ_1_15_11_REMOVE_TERMINATED: DraftRule = fileRule({
  id: "REQ-1.15.11",
  title: "UPI Remove Terminated Staff — One Calendar Day",
  liveKey: "upi_remove_terminated_staff",
  clauses: ["SOW §1.15(11)"],
  predicate: CHANGE_PRED("upi_remove_terminated_staff"),
  timing: ONE_DAY_TERMINATION,
  summary:
    "Remove terminated Staff from the \"Provider Organization\" within one Calendar Day of termination.",
  routes: ["UPLOAD"],
  handling: "Uploaded confirmation of Provider Organization removal within one Calendar Day is the handling path.",
  memberLabel: "Terminated Staff removed from the Provider Organization within one Calendar Day",
  tests: [
    ["positive", "Removal from the Provider Organization within one Calendar Day of termination satisfies the parent."],
    ["negative", "A terminated staff member still in the Provider Organization after one Calendar Day leaves the parent incomplete."],
    ["boundary", "Opens on staff termination. Do not invent hire+N. Distinct from the USTEPS notify parent."],
  ],
});

export const REQ_1_15_12_REMOVE_NEED_TO_KNOW: DraftRule = fileRule({
  id: "REQ-1.15.12",
  title: "UPI Remove Staff Need-to-Know — One Calendar Day",
  liveKey: "upi_remove_staff_need_to_know",
  clauses: ["SOW §1.15(12)"],
  predicate: CHANGE_PRED("upi_remove_staff_need_to_know"),
  timing: ONE_DAY_TERMINATION,
  summary:
    "Remove Staff from an organizational group within one Calendar Day of the Staff no longer needing to know the information in UPI to provide professional treatment or coordinate DSPD services.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External UPI group removal plus uploaded confirmation within one Calendar Day is the handling path.",
  memberLabel: "Staff removed from the organizational group within one Calendar Day of losing need-to-know",
  tests: [
    ["positive", "Removal from the organizational group within one Calendar Day of lost need-to-know satisfies the parent."],
    ["negative", "A staff member who no longer needs to know still in the group after one Calendar Day leaves the parent incomplete."],
    ["boundary", "Which staff hold UPI access unanswered stays a question. Distinct from full Provider Organization removal."],
  ],
});

export const REQ_1_15_13_REMOVE_PERSON: DraftRule = fileRule({
  id: "REQ-1.15.13",
  title: "UPI Remove Discharged Person from Provider Organization",
  liveKey: "upi_remove_discharged_person",
  clauses: ["SOW §1.15(13)"],
  predicate: CHANGE_PRED("upi_remove_discharged_person"),
  timing: STANDING_NONE,
  summary:
    "Remove a Person from the \"Provider Organization\" when the Contractor is no longer providing services to that Person, and has completed all business requiring the Person to remain in the \"Provider Organization\".",
  routes: ["UPLOAD"],
  handling: "Uploaded confirmation of Provider Organization removal after remaining business is complete is the handling path.",
  memberLabel: "Person removed from the Provider Organization after services and remaining business end",
  tests: [
    ["positive", "Removal after services end and remaining business is complete satisfies the parent."],
    ["negative", "A discharged Person left in the Provider Organization after remaining business ends leaves the parent incomplete."],
    ["boundary", "Do not absorb person_discharge_process. Timing stays missing-information — do not invent a day count."],
  ],
});

export const REQ_1_15_14_ANNUAL_REVIEW: DraftRule = fileRule({
  id: "REQ-1.15.14",
  title: "UPI Annual Staff Access Review",
  liveKey: "upi_annual_access_review",
  clauses: ["SOW §1.15(14)"],
  predicate: CONTRACTOR_PRED("upi_annual_access_review"),
  timing: ANNUAL_ANCHOR_NONE,
  summary:
    "Conduct and document an annual review of all staff with UPI access to ensure all Staff with UPI access have the correct UPI access and the UPI Provider Organization is correct and current. Annual anchor is missing-information.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "Documented annual UPI access / Provider Organization review plus uploaded confirmation is the handling path.",
  memberLabel: "Documented annual review of staff UPI access and the UPI Provider Organization",
  tests: [
    ["positive", "A documented annual UPI access and Provider Organization review satisfies the parent."],
    ["negative", "A missing annual review document leaves the parent incomplete."],
    ["boundary", "Do not invent employment-year, fiscal-year, or annual-from-completion as the anchor."],
  ],
});

export const REQ_1_15_15_NOTIFY_USTEPS: DraftRule = fileRule({
  id: "REQ-1.15.15",
  title: "Notify DSPD USTEPS of UPI Staff Termination — One Calendar Day",
  liveKey: "upi_notify_usteps_termination",
  clauses: ["SOW §1.15(15)"],
  predicate: CHANGE_PRED("upi_notify_usteps_termination"),
  timing: ONE_DAY_UPI_TERMINATION,
  summary:
    "Notify the DSPD USTEPS team within one Calendar Day of the termination of Staff with UPI access. Staff never touch UPI from this parent.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "Logged notice to the DSPD USTEPS team plus uploaded confirmation is the handling path.",
  memberLabel: "DSPD USTEPS team notified within one Calendar Day of UPI-access staff termination",
  tests: [
    ["positive", "A logged DSPD USTEPS notice within one Calendar Day of UPI-access staff termination satisfies the parent."],
    ["negative", "A missing USTEPS notice after UPI-access staff termination leaves the parent incomplete."],
    ["boundary", "Distinct from Provider Organization removal. Which staff hold UPI access unanswered stays a question."],
  ],
});

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.15.1": REQ_1_15_1_FORM_0_9,
  "REQ-1.15.2": REQ_1_15_2_FORM_0_8,
  "REQ-1.15.3": REQ_1_15_3_NEED_TO_KNOW,
  "REQ-1.15.4": REQ_1_15_4_1056_DECISION,
  "REQ-1.15.5": REQ_1_15_5_1056_REJECT,
  "REQ-1.15.6": REQ_1_15_6_UTILIZATION,
  "REQ-1.15.7": REQ_1_15_7_PROVIDER_ORG,
  "REQ-1.15.8": REQ_1_15_8_STAFF_GROUPS,
  "REQ-1.15.9": REQ_1_15_9_STAFF_NOTIFY,
  "REQ-1.15.10": REQ_1_15_10_PERSON_GROUPS,
  "REQ-1.15.11": REQ_1_15_11_REMOVE_TERMINATED,
  "REQ-1.15.12": REQ_1_15_12_REMOVE_NEED_TO_KNOW,
  "REQ-1.15.13": REQ_1_15_13_REMOVE_PERSON,
  "REQ-1.15.14": REQ_1_15_14_ANNUAL_REVIEW,
  "REQ-1.15.15": REQ_1_15_15_NOTIFY_USTEPS,
};

function binding(
  ruleId: NinthExecutableBatchRuleId,
  liveKey: NinthExecutableBatchLiveKey,
  evidence: NinthBatchEngineBinding["evidence"],
  liveFactKey: NinthBatchLiveFactKey,
  disposition: NinthBatchEngineBinding["disposition"],
): NinthBatchEngineBinding {
  return {
    ruleId,
    liveKeys: [liveKey],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence,
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: evidence === "system_check" ? "record_review" : "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey,
    disposition,
    sharesLiveKeyWith: [],
  };
}

export const NINTH_BATCH_ENGINE_BINDINGS: readonly NinthBatchEngineBinding[] = [
  binding("REQ-1.15.1", "upi_form_0_9_designee", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.2", "upi_form_0_8_user", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.3", "upi_need_to_know_access", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.4", "upi_1056_decision", "external_then_upload", "authorization_1056", "standing"),
  binding("REQ-1.15.5", "upi_1056_reject_coordinate", "upload_file", "authorization_1056", "standing"),
  binding("REQ-1.15.6", "upi_1056_utilization", "system_check", "authorization_1056", "by_design"),
  binding("REQ-1.15.7", "upi_provider_organization", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.8", "upi_staff_org_groups", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.9", "upi_staff_notify_prefs", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.10", "upi_person_org_groups", "upload_file", "contractor_upi_file", "standing"),
  binding("REQ-1.15.11", "upi_remove_terminated_staff", "upload_file", "contractor_upi_file", "standing"),
  binding("REQ-1.15.12", "upi_remove_staff_need_to_know", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.13", "upi_remove_discharged_person", "upload_file", "contractor_upi_file", "standing"),
  binding("REQ-1.15.14", "upi_annual_access_review", "external_then_upload", "upi_access_staff", "standing"),
  binding("REQ-1.15.15", "upi_notify_usteps_termination", "external_then_upload", "upi_access_staff", "standing"),
];

export const NINTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record which staff hold UPI access and which 1056s are open",
    detail:
      "FACT-009 (Which staff hold UPI access?) stays a question until recorded. 1056 approve/reject and utilization follow live authorizations. Empty stays unanswered — never silent N/A. Staff never touch UPI.",
  },
  {
    step: "task",
    title: "One parent card per upi_* live key",
    detail:
      "Fifteen Article 1.15 parents. Adjacent to usteps_upi_accounts (REQ-1.4.2) — not collapsed onto that card. Child items stay on the parent. Product = Provider Interface.",
  },
  {
    step: "evidence",
    title: "Complete in UPI/USTEPS, then record proof — utilization is SYSTEM",
    detail:
      "0-9 / 0-8 forms, need-to-know roster, Provider Organization, staff/person groups, termination removals, annual review, and USTEPS notice are EXTERNAL then UPLOAD. 1056 utilization is the live remaining-units check.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload/record review",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. Soft=none — this batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the official workbook trigger only",
    detail:
      "15 calendar days from a new or adjusted 1056. 1 calendar day from termination / lost need-to-know. Annual review keeps current — do not invent an annual-from-completion anchor. Standing files are keep-current.",
  },
] as const;

export function isNinthExecutableBatchRuleId(ruleId: string): boolean {
  return (NINTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isNinthExecutableBatchLiveKey(key: string): boolean {
  return (NINTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function ninthBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForNinthBatchKey(factKey: NinthBatchLiveFactKey): string {
  if (factKey === "upi_access_staff") return "FACT-009";
  if (factKey === "authorization_1056") return "LIVE-authorization_1056";
  return "LIVE-contractor_upi_file";
}

const LIVE_FACT_QUESTIONS: Record<NinthBatchLiveFactKey, string> = {
  contractor_upi_file: "Is the contractor UPI / USTEPS ops file current?",
  upi_access_staff: "Which staff hold UPI access?",
  authorization_1056: "Which persons have an active 1056 authorization for each awarded code?",
};

export function ninthBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const row = NINTH_BATCH_ENGINE_BINDINGS.find((bindingRow) => bindingRow.ruleId === ruleId);
  if (!row) return [];
  if (row.liveFactKey === "contractor_upi_file") return [];
  return [
    {
      fact_id: liveFactIdForNinthBatchKey(row.liveFactKey),
      question: LIVE_FACT_QUESTIONS[row.liveFactKey],
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

export function applyNinthExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = ninthBatchFixtureFor(rule.id);
  if (!fixture || !isNinthExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, ninthBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyNinthExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applyNinthExecutableBatchOverlay(rule));
}

export function ninthExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isNinthExecutableBatchRuleId(rule.id))
    .map((rule) => applyNinthExecutableBatchOverlay(rule));
}

export function ninthBatchBindingForRule(ruleId: string): NinthBatchEngineBinding | null {
  return NINTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function ninthBatchLiveEngineReady(row: NinthBatchEngineBinding): {
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
  return { ready: reasons.length === 0, reasons };
}

export function ninthBatchAssignmentOpensClock(
  _liveKey: NinthExecutableBatchLiveKey,
  _upiAccessStaffKnown: boolean | null = null,
): boolean {
  return true;
}

export function ninthBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function ninthBatchParentIsWired(rule: DraftRule): boolean {
  if (!isNinthExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyNinthExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isNinthExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid) && !canActivate(overlaid);
}

export function ninthBatchSharedLiveKeyParents(liveKey: string): string[] {
  return NINTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as NinthExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function ninthBatchOmitsInventedQuarterlyOutcomesAndPn(): boolean {
  const keys = NINTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = NINTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
    !keys.includes("usteps_upi_accounts") &&
    !keys.includes("hhs_evac_drills_quarterly") &&
    !keys.includes("rhs_evac_drills_quarterly") &&
    !keys.includes("pps_evac_drills_quarterly") &&
    !keys.includes("hhs_annual_outcome") &&
    !keys.includes("dsi_annual_outcome") &&
    !keys.includes("sei_annual_outcome") &&
    !keys.includes("sl_annual_outcome") &&
    !keys.includes("medicaid_disclosure_annual") &&
    !keys.includes("sei_employment_data_upi") &&
    !keys.includes("sjd_employment_data_upi") &&
    !keys.includes("fba_bsp") &&
    !rules.includes("REQ-1.4.2") &&
    !rules.includes("REQ-1.24") &&
    !rules.includes("REQ-1.24.1") &&
    !rules.includes("REQ-1.24.2") &&
    !rules.includes("REQ-8.6") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-11.7")
  );
}
