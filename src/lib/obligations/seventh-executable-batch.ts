/**
 * Mega A / seventh shared-behavior executable batch: Article 1 provider
 * enrollment files plus hire/annual credential clocks.
 *
 * Overlays executable fields onto imported catalog parents that already
 * have live company_obligations keys. Child elements stay on the parent.
 * Timing is copied from the live pack due_rule — no invented hire+N,
 * annual-from-completion, PN1/PN2, quarterly evac, or annual-outcome keys.
 * Publication stays off until VERIFIED_PUBLICATIONS is filled deliberately.
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

export const SEVENTH_EXECUTABLE_BATCH_ID = "article1_enrollment_credential_files" as const;

/** Imported catalog parents this mega overlays. */
export const SEVENTH_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.4.1",
  "REQ-1.4.2",
  "REQ-1.6",
  "REQ-1.7.1",
  "REQ-1.7.2",
  "REQ-1.9.2",
  "REQ-1.9.4",
  "REQ-1.9.7",
  "REQ-1.13",
  "REQ-1.13.2",
] as const;

export const SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS = [
  "medicaid_enrollment",
  "usteps_upi_accounts",
  "volunteer_training_file",
  "medicaid_101_contractor",
  "medicaid_manuals_memo",
  "background_screening_annual",
  "educational_credentials",
  "medicaid_exclusion_annual",
  "medicaid_change_notifications",
] as const;

export type SeventhExecutableBatchRuleId = (typeof SEVENTH_EXECUTABLE_BATCH_RULE_IDS)[number];
export type SeventhExecutableBatchLiveKey = (typeof SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type SeventhBatchLiveFactKey =
  | "contractor_medicaid_file"
  | "uses_volunteers"
  | "staff_personnel_file";

export type SeventhBatchEngineBinding = {
  ruleId: SeventhExecutableBatchRuleId;
  liveKeys: readonly SeventhExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "hire_and_roster_reeval" | "contractor_file_reeval";
  evidence: "upload_file" | "upload_cert" | "external_then_upload";
  trainingTitle: null;
  formTitle: null;
  reminders: "product_default";
  adminReview: "upload_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: SeventhBatchLiveFactKey;
  disposition: "obligation" | "standing";
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
  id: SeventhExecutableBatchRuleId;
  title: string;
  liveKey: SeventhExecutableBatchLiveKey;
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
  reason: "Standing live-pack file — keep current. Calendar is reminder-only. Do not invent hire+N.",
};

const CONTRACTOR_CALENDAR_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Live pack calendar_year due_rule (Medicaid 101 July 31 / manuals Sept 28). Do not invent hire+N or annual-from-completion.",
};

const UNIVERSAL_PRED = (key: SeventhExecutableBatchLiveKey): DraftPredicate => ({
  kind: "universal_staff",
  catalogKey: key,
});

const CONTRACTOR_PRED = (key: SeventhExecutableBatchLiveKey): DraftPredicate => ({
  kind: "contractor_standing_file",
  catalogKey: key,
});

export const REQ_1_4_1_MEDICAID_ENROLLMENT: DraftRule = fileRule({
  id: "REQ-1.4.1",
  title: "Medicaid provider enrollment — current",
  liveKey: "medicaid_enrollment",
  clauses: ["SOW §1.4", "SOW §1.4(1)"],
  predicate: CONTRACTOR_PRED("medicaid_enrollment"),
  timing: STANDING_NONE,
  summary:
    "Current Medicaid provider enrollment on the live medicaid_enrollment file. Shares the key with REQ-1.13. A generic attestation is not equivalency.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the current enrollment record is the handling path, not automatic equivalency.",
  memberLabel: "Current Medicaid provider enrollment",
  tests: [
    ["positive", "A current uploaded Medicaid enrollment record satisfies the parent file."],
    ["negative", "A generic attestation without the enrollment record leaves the parent incomplete."],
    ["boundary", "REQ-1.4.1 and REQ-1.13 share medicaid_enrollment — one live card, not two clocks."],
  ],
});

export const REQ_1_4_2_USTEPS_UPI: DraftRule = fileRule({
  id: "REQ-1.4.2",
  title: "USTEPS and UPI contractor accounts",
  liveKey: "usteps_upi_accounts",
  clauses: ["SOW §1.4", "SOW §1.4(2)"],
  predicate: CONTRACTOR_PRED("usteps_upi_accounts"),
  timing: STANDING_NONE,
  summary:
    "Current USTEPS and UPI contractor accounts on the live usteps_upi_accounts file. Staff never touch UPI from this parent.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External account plus uploaded confirmation is the handling path.",
  memberLabel: "Current USTEPS and UPI contractor accounts",
  tests: [
    ["positive", "Active USTEPS/UPI accounts with uploaded confirmation satisfy the parent."],
    ["negative", "A missing USTEPS or UPI account leaves the parent incomplete."],
    ["boundary", "This parent does not mint a staff UPI-entry clock and does not invent PN1/PN2."],
  ],
});

export const REQ_1_6_VOLUNTEER_FILE: DraftRule = fileRule({
  id: "REQ-1.6",
  title: "Volunteer training file — when volunteers are used",
  liveKey: "volunteer_training_file",
  clauses: ["SOW §1.6"],
  predicate: CONTRACTOR_PRED("volunteer_training_file"),
  timing: STANDING_NONE,
  summary:
    "When regularly scheduled volunteers are used, keep the §1.6 training file on volunteer_training_file. Friends the Person chooses are not volunteers. Empty uses_volunteers stays a question — never silent N/A.",
  routes: ["UPLOAD"],
  handling: "Upload of the volunteer training file is the handling path when the volunteer fact is yes.",
  memberLabel: "Volunteer training file",
  tests: [
    ["positive", "uses_volunteers=yes plus an uploaded training file satisfies the parent."],
    ["negative", "uses_volunteers=no does not open the volunteer file clock."],
    ["boundary", "uses_volunteers unanswered stays missing-information, never auto N/A."],
  ],
});

export const REQ_1_7_1_MEDICAID_101: DraftRule = fileRule({
  id: "REQ-1.7.1",
  title: "DHHS Medicaid 101 — contractor",
  liveKey: "medicaid_101_contractor",
  clauses: ["SOW §1.7(1)"],
  predicate: CONTRACTOR_PRED("medicaid_101_contractor"),
  timing: CONTRACTOR_CALENDAR_NONE,
  summary:
    "Contractor-level DHHS Medicaid 101 on medicaid_101_contractor. Not the staff orientation topic in §1.8(4). Live pack due_rule is calendar_year July 31.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the DHHS Medicaid 101 completion record is the handling path.",
  memberLabel: "DHHS Medicaid 101 completion for the current contract year",
  tests: [
    ["positive", "Uploaded DHHS Medicaid 101 completion for the contract year satisfies the parent."],
    ["negative", "Staff 30-day orientation completion does not satisfy contractor Medicaid 101."],
    ["boundary", "Due stays the live calendar_year July 31 rule — do not invent hire+30 as this clock."],
  ],
});

export const REQ_1_7_2_MANUALS_MEMO: DraftRule = fileRule({
  id: "REQ-1.7.2",
  title: "Utah Medicaid provider manuals — annual memo",
  liveKey: "medicaid_manuals_memo",
  clauses: ["SOW §1.7(2)", "SOW §1.7(3)", "SOW §1.7(4)"],
  predicate: CONTRACTOR_PRED("medicaid_manuals_memo"),
  timing: CONTRACTOR_CALENDAR_NONE,
  summary:
    "Signed contractor memo that Utah Medicaid manuals, Medicaid rules, DSPD R539, and applicable DHHS rules have been read. Live pack due_rule is calendar_year September 28. One memo covers §1.7(2)–(4).",
  routes: ["UPLOAD"],
  handling: "Upload of the signed familiarity memo is the handling path, not a second annual clock per subsection.",
  memberLabel: "Signed Medicaid manuals / rules familiarity memo",
  tests: [
    ["positive", "A signed manuals-and-rules memo satisfies the parent for §1.7(2)–(4)."],
    ["negative", "A missing memo leaves the parent incomplete."],
    ["boundary", "Do not mint separate annual clocks for §1.7(3) or §1.7(4)."],
  ],
});

export const REQ_1_9_2_BACKGROUND: DraftRule = fileRule({
  id: "REQ-1.9.2",
  title: "Background screening — annual",
  liveKey: "background_screening_annual",
  clauses: ["SOW §1.9(2)"],
  predicate: UNIVERSAL_PRED("background_screening_annual"),
  timing: { kind: "employment_year", startYear: 1 },
  summary:
    "Current background screening clearance on background_screening_annual. Applies to every employed staff member (UNIVERSAL_STAFF_KEYS). Hire-anniversary year 1 from the live pack.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the current BCI / Office of Background Processing clearance is the handling path.",
  memberLabel: "Current background screening clearance",
  tests: [
    ["positive", "Every employed staff member with a current clearance satisfies the parent."],
    ["negative", "A missing clearance leaves that staff member's parent incomplete."],
    ["boundary", "Due is hire anniversary year 1 — a later printed expiration wins; do not invent another interval."],
  ],
});

export const REQ_1_9_4_EDUCATIONAL: DraftRule = fileRule({
  id: "REQ-1.9.4",
  title: "Educational credentials and licenses — on file",
  liveKey: "educational_credentials",
  clauses: ["SOW §1.9(4)"],
  predicate: UNIVERSAL_PRED("educational_credentials"),
  timing: { kind: "hire_plus_days", days: 30 },
  summary:
    "Copies of applicable transcripts, degrees, licenses, and certifications on educational_credentials. Live pack due_rule is days_after_hire 30. Not a recurring training class.",
  routes: ["UPLOAD"],
  handling: "Upload of the credential copies is the handling path, not an invented annual renewal.",
  memberLabel: "Educational transcripts, degrees, licenses, and certifications",
  tests: [
    ["positive", "Uploaded applicable educational credentials within 30 days of hire satisfy the parent."],
    ["negative", "An empty personnel-file credential slot leaves the parent incomplete."],
    ["boundary", "No invented annual-from-completion — the live pack is hire+30, then keep current."],
  ],
});

export const REQ_1_9_7_EXCLUSION: DraftRule = fileRule({
  id: "REQ-1.9.7",
  title: "Medicaid fraud and abuse exclusion screening — annual",
  liveKey: "medicaid_exclusion_annual",
  clauses: ["SOW §1.9(7)"],
  predicate: UNIVERSAL_PRED("medicaid_exclusion_annual"),
  timing: { kind: "employment_year", startYear: 1 },
  summary:
    "OIG LEIE / Medicaid exclusion screening on medicaid_exclusion_annual. Applies to every employed staff member. Hire-anniversary year 1 from the live pack.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the exclusion-screening confirmation is the handling path.",
  memberLabel: "Medicaid fraud / exclusion screening with no exclusions found",
  tests: [
    ["positive", "Current exclusion-screening confirmation with no exclusions satisfies the parent."],
    ["negative", "A missing exclusion check leaves the parent incomplete."],
    ["boundary", "Do not invent REQ-1.9.6 disclosure here — that live key has no imported parent."],
  ],
});

export const REQ_1_13_MEDICAID_ENROLLMENT: DraftRule = fileRule({
  id: "REQ-1.13",
  title: "Medicaid provider requirements — enrollment",
  liveKey: "medicaid_enrollment",
  clauses: ["SOW §1.13"],
  predicate: CONTRACTOR_PRED("medicaid_enrollment"),
  timing: STANDING_NONE,
  summary:
    "Article 1.13 enrollment reuses medicaid_enrollment with REQ-1.4.1. One live card. Change notifications stay on medicaid_change_notifications.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the current enrollment record is the handling path, shared with REQ-1.4.1.",
  memberLabel: "Current Medicaid provider enrollment",
  tests: [
    ["positive", "The shared medicaid_enrollment file satisfies REQ-1.13 without a second card."],
    ["negative", "A change-notification record does not satisfy enrollment."],
    ["boundary", "REQ-1.13 and REQ-1.4.1 collapse to one live key."],
  ],
});

export const REQ_1_13_2_CHANGE_NOTICE: DraftRule = fileRule({
  id: "REQ-1.13.2",
  title: "Medicaid provider change notifications",
  liveKey: "medicaid_change_notifications",
  clauses: ["SOW §1.13", "SOW §1.13(2)"],
  predicate: CONTRACTOR_PRED("medicaid_change_notifications"),
  timing: STANDING_NONE,
  summary:
    "Notify DSPD of phone, address, or email changes on medicaid_change_notifications. Independent of the enrollment file. Do not invent a 30-day ownership-change clock here.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "Logged notice to dspdcontracts@utah.gov is the handling path, not enrollment equivalency.",
  memberLabel: "DSPD contract-team change notification",
  tests: [
    ["positive", "A logged DSPD change notice satisfies the parent."],
    ["negative", "The enrollment file alone does not satisfy a required change notice."],
    ["boundary", "Do not absorb REQ-1.13.3 ownership/tax-ID changes into this live key."],
  ],
});

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.4.1": REQ_1_4_1_MEDICAID_ENROLLMENT,
  "REQ-1.4.2": REQ_1_4_2_USTEPS_UPI,
  "REQ-1.6": REQ_1_6_VOLUNTEER_FILE,
  "REQ-1.7.1": REQ_1_7_1_MEDICAID_101,
  "REQ-1.7.2": REQ_1_7_2_MANUALS_MEMO,
  "REQ-1.9.2": REQ_1_9_2_BACKGROUND,
  "REQ-1.9.4": REQ_1_9_4_EDUCATIONAL,
  "REQ-1.9.7": REQ_1_9_7_EXCLUSION,
  "REQ-1.13": REQ_1_13_MEDICAID_ENROLLMENT,
  "REQ-1.13.2": REQ_1_13_2_CHANGE_NOTICE,
};

export const SEVENTH_BATCH_ENGINE_BINDINGS: readonly SeventhBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.4.1",
    liveKeys: ["medicaid_enrollment"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "standing",
    sharesLiveKeyWith: ["REQ-1.13"],
  },
  {
    ruleId: "REQ-1.4.2",
    liveKeys: ["usteps_upi_accounts"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.6",
    liveKeys: ["volunteer_training_file"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "uses_volunteers",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.7.1",
    liveKeys: ["medicaid_101_contractor"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.7.2",
    liveKeys: ["medicaid_manuals_memo"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.9.2",
    liveKeys: ["background_screening_annual"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "hire_and_roster_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "staff_personnel_file",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.9.4",
    liveKeys: ["educational_credentials"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "hire_and_roster_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "staff_personnel_file",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.9.7",
    liveKeys: ["medicaid_exclusion_annual"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "hire_and_roster_reeval",
    evidence: "upload_cert",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "staff_personnel_file",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.13",
    liveKeys: ["medicaid_enrollment"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "standing",
    sharesLiveKeyWith: ["REQ-1.4.1"],
  },
  {
    ruleId: "REQ-1.13.2",
    liveKeys: ["medicaid_change_notifications"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "contractor_file_reeval",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "contractor_medicaid_file",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
];

export const SEVENTH_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record the contractor file and the employed roster",
    detail:
      "Medicaid enrollment and USTEPS/UPI are contractor files. Volunteer training opens only when uses_volunteers is recorded. Background, education, and exclusion follow every employed staff member. Empty volunteer fact stays a question.",
  },
  {
    step: "task",
    title: "One parent card per live key",
    detail:
      "REQ-1.4.1 and REQ-1.13 share medicaid_enrollment. Staff credential clocks are one card per staff on that live key. Child file items stay on the parent.",
  },
  {
    step: "evidence",
    title: "Upload the live-pack file — no generic quiz substitute",
    detail:
      "Enrollment packet, USTEPS/UPI confirmation, volunteer file, Medicaid 101 completion, manuals memo, background clearance, educational copies, exclusion screen, change notice. Orientation does not absorb contractor Medicaid 101.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing upload/cert review",
    detail:
      "Submitted uploads sit in cert/upload review. Product reminders go to the reviewer. Acceptance greens the parent. Soft=none — this batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule only",
    detail:
      "Background and exclusion renew on hire anniversary year 1. Educational credentials are hire+30 then keep current. Contractor Medicaid 101 / manuals stay on the live calendar_year dates. Standing files are keep-current.",
  },
] as const;

export function isSeventhExecutableBatchRuleId(ruleId: string): boolean {
  return (SEVENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isSeventhExecutableBatchLiveKey(key: string): boolean {
  return (SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function seventhBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForSeventhBatchKey(factKey: SeventhBatchLiveFactKey): string {
  if (factKey === "uses_volunteers") return "FACT-035";
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<SeventhBatchLiveFactKey, string> = {
  contractor_medicaid_file: "Is the contractor Medicaid / USTEPS file current?",
  uses_volunteers: "Does this contractor use regularly scheduled volunteers?",
  staff_personnel_file: "Which staff have an active employment record?",
};

export function seventhBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = SEVENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  if (binding.liveFactKey === "contractor_medicaid_file") return [];
  return [
    {
      fact_id: liveFactIdForSeventhBatchKey(binding.liveFactKey),
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

export function applySeventhExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = seventhBatchFixtureFor(rule.id);
  if (!fixture || !isSeventhExecutableBatchRuleId(rule.id)) return rule;
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
            seventhBatchLiveFactsForRule(rule.id),
          ),
        }
      : {}),
  };
}

export function applySeventhExecutableBatchOverlayAll<T extends DraftRule>(
  rules: readonly T[],
): T[] {
  return rules.map((rule) => applySeventhExecutableBatchOverlay(rule));
}

export function seventhExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isSeventhExecutableBatchRuleId(rule.id))
    .map((rule) => applySeventhExecutableBatchOverlay(rule));
}

export function seventhBatchBindingForRule(ruleId: string): SeventhBatchEngineBinding | null {
  return SEVENTH_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function seventhBatchLiveEngineReady(binding: SeventhBatchEngineBinding): {
  ready: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const key of binding.liveKeys) {
    const entry = sowCatalogEntryByKey(key);
    if (!entry) reasons.push(`Missing live pack key ${key}.`);
    else if (entry.disposition !== binding.disposition) {
      reasons.push(`${key} is ${entry.disposition}, expected ${binding.disposition}.`);
    }
  }
  if (binding.parentAssignment !== "one") {
    reasons.push("Parent assignment must stay one — no per-element staff tasks.");
  }
  if (binding.mintsElementTasks) {
    reasons.push("Child elements must not mint staff tasks.");
  }
  if (binding.trainingTitle !== null) {
    reasons.push("This batch does not invent an in-Hive course.");
  }
  if (binding.formTitle !== null) {
    reasons.push("This batch does not invent a person form.");
  }
  if (binding.reminders !== "product_default") {
    reasons.push("Reminders must reuse product-default offsets, not invented SOW intervals.");
  }
  if (PRODUCT_REMINDER_OFFSETS_DAYS.length === 0) {
    reasons.push("Product reminder offsets are missing.");
  }
  if (binding.blocksSoloWhenLapsed !== isBlocksSoloWhenLapsedKey(binding.liveKeys[0])) {
    reasons.push(`Solo-lapse wiring mismatch for ${binding.liveKeys[0]}.`);
  }
  if (
    binding.liveFactKey === "staff_personnel_file" &&
    !binding.liveKeys.every((key) =>
      (UNIVERSAL_STAFF_KEYS as readonly string[]).includes(key),
    )
  ) {
    reasons.push(`${binding.ruleId} staff credential key is not in UNIVERSAL_STAFF_KEYS.`);
  }
  return { ready: reasons.length === 0, reasons };
}

export function seventhBatchAssignmentOpensClock(
  liveKey: SeventhExecutableBatchLiveKey,
  staff: StaffDutyFacts,
  orgUsesVolunteers: boolean | null = null,
): boolean {
  if (liveKey === "volunteer_training_file") {
    return orgUsesVolunteers === true;
  }
  if ((UNIVERSAL_STAFF_KEYS as readonly string[]).includes(liveKey)) {
    return staffReceivesDutyClock(evaluateStaffDuty({ dutyKey: liveKey, staff }));
  }
  return true;
}

export function seventhBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function seventhBatchParentIsWired(rule: DraftRule): boolean {
  if (!isSeventhExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applySeventhExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isSeventhExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid);
}

export function seventhBatchSharedLiveKeyParents(liveKey: string): string[] {
  return SEVENTH_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as SeventhExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function seventhBatchOmitsInventedQuarterlyOutcomesAndPn(): boolean {
  const keys = SEVENTH_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = SEVENTH_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
  return (
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
    !rules.includes("REQ-1.9") &&
    !rules.includes("REQ-1.9.6") &&
    !rules.includes("REQ-8.6") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-11.7") &&
    !rules.includes("REQ-18.5") &&
    !rules.includes("REQ-19.2.7")
  );
}
