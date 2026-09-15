/**
 * Mega C / person-file and site leftovers: intake, support strategies,
 * and HHS/RHS site files.
 *
 * Overlays executable fields onto imported catalog parents that already
 * have live company_obligations keys. Child elements stay on the parent.
 * REQ-1.9 is a false-friend of batch 1 — it citation-collides onto
 * ce_12h_annual. This mega shares that live card with REQ-1.8.7; it does
 * not mint a second CE clock or invent hire+N / annual-from-completion.
 * Do not invent evac, annual-outcome, PN1/PN2, or medicaid_disclosure_annual
 * parents. Publication stays off until VERIFIED_PUBLICATIONS is filled
 * deliberately.
 */

import { SUPPORT_STRATEGIES_OBLIGATION_TITLE } from "../client-form-obligations.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";
import { awardedCodeDutyStatus, type OrgFacts } from "./applicability.ts";
import { liveObligationKeyForRule, staffTaskPolicyForRule } from "./catalog-live-bridge.ts";
import { isBlocksSoloWhenLapsedKey } from "./solo-lapse.ts";
import {
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

export const MEGA_C_EXECUTABLE_BATCH_ID = "person_file_site_leftovers" as const;

/** Imported catalog parents this mega overlays. */
export const MEGA_C_EXECUTABLE_BATCH_RULE_IDS = [
  "REQ-1.9",
  "REQ-1.10.11",
  "REQ-1.24.5",
  "REQ-1.35",
  "REQ-11.3.5",
  "REQ-11.3.9",
  "REQ-11.5",
  "REQ-21.3.1",
  "REQ-21.5",
] as const;

export const MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS = [
  "ce_12h_annual",
  "grievance_acknowledgment",
  "support_strategies",
  "housemate_informed_choice",
  "belongings_inventory",
  "hhs_room_board_agreement",
  "hhs_home_cert_annual",
  "rhs_lease_agreement",
  "ol_rhs_license_4plus",
] as const;

export type MegaCExecutableBatchRuleId = (typeof MEGA_C_EXECUTABLE_BATCH_RULE_IDS)[number];
export type MegaCExecutableBatchLiveKey = (typeof MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS)[number];

export type MegaCBatchLiveFactKey =
  | "direct_support_assignment"
  | "person_file_intake"
  | "support_strategies_assignment"
  | "residential_housemates"
  | "belongings_codes"
  | "hhs_awarded"
  | "rhs_awarded";

export type MegaCBatchEngineBinding = {
  ruleId: MegaCExecutableBatchRuleId;
  liveKeys: readonly MegaCExecutableBatchLiveKey[];
  parentAssignment: "one";
  mintsElementTasks: false;
  assignment: "caseload_reeval" | "companion_of_batch_1";
  evidence: "upload_hours" | "in_platform_form" | "upload_file" | "external_then_upload";
  trainingTitle: null;
  formTitle: string | null;
  reminders: "product_default";
  adminReview: "upload_review" | "form_review" | "record_review";
  blocksSoloWhenLapsed: boolean;
  liveFactKey: MegaCBatchLiveFactKey;
  disposition: "obligation" | "intake" | "by_design" | "standing";
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
  id: MegaCExecutableBatchRuleId;
  title: string;
  liveKey: MegaCExecutableBatchLiveKey;
  clauses: string[];
  predicate: DraftPredicate;
  timing: TimingAnchor;
  summary: string;
  routes: CompletionRoute[];
  handling: string;
  memberLabel: string;
  conditionNote?: string;
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
      conditionNote: input.conditionNote,
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

const MISSING_NONE: TimingAnchor = {
  kind: "none",
  reason: "Timing is missing-information. Do not invent an interval or annual-from-completion.",
};

const ADMISSION_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Admission / first service on the live standing intake file. Do not invent hire+N or annual-from-completion.",
};

const PCSP_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Live pack days_after_event (30 days after PCSP created or updated). Do not invent hire+N or annual-from-completion.",
};

const HOUSEMATE_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Placement or housemate change on the live standing intake file. Do not invent an annual clock.",
};

const BELONGINGS_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Admission; update as items are added or discarded. Live register is keep-current. Do not invent annual-from-completion.",
};

const HHS_CERT_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Before HHS begins in the home, then the live calendar_year July 1 reminder. Do not invent hire+N.",
};

const OL_LICENSE_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Once; re-verify on printed renewal/expiry. Live July 1 date is reminder-only. Do not invent hire+N.",
};

const CE_COMPANION_NONE: TimingAnchor = {
  kind: "none",
  reason:
    "Workbook timing is missing-information. The live ce_12h_annual clock stays on REQ-1.8.7 (employment year 2). Do not invent a second interval or annual-from-completion here.",
};

export const REQ_1_9_CE_COMPANION: DraftRule = fileRule({
  id: "REQ-1.9",
  title: "Personnel-file continuing education — companion of the §1.8(7) clock",
  liveKey: "ce_12h_annual",
  clauses: ["SOW §1.9"],
  predicate: { kind: "direct_support_assignment", catalogKey: "ce_12h_annual" },
  timing: CE_COMPANION_NONE,
  conditionNote:
    "False-friend of batch 1. REQ-1.9 citation-collides onto ce_12h_annual. One live card with REQ-1.8.7 — do not mint a second CE clock.",
  summary:
    "Same live ce_12h_annual file as REQ-1.8.7. Upload of the 12 DSPD-approved hours greens that card. A generic attestation is not equivalency. This parent does not invent a second anniversary window.",
  routes: ["UPLOAD", "IN_PLATFORM"],
  handling:
    "The batch-1 employment-year CE file is the handling path. This parent does not add a second card or a second due rule.",
  memberLabel: "12 DSPD-approved hours on the shared ce_12h_annual file",
  tests: [
    [
      "positive",
      "Direct-support staff with accepted CE hours on ce_12h_annual satisfy both REQ-1.8.7 and REQ-1.9.",
    ],
    ["negative", "Office staff without a client assignment do not receive the shared CE card."],
    [
      "boundary",
      "REQ-1.9 shares ce_12h_annual with REQ-1.8.7 — one My tasks card. Timing stays missing-information on this parent; do not invent annual-from-completion.",
    ],
  ],
});

export const REQ_1_10_11_GRIEVANCE: DraftRule = fileRule({
  id: "REQ-1.10.11",
  title: "Grievance policy acknowledgment — signed at intake",
  liveKey: "grievance_acknowledgment",
  clauses: ["SOW §1.10(11)"],
  predicate: { kind: "person_file_intake", catalogKey: "grievance_acknowledgment" },
  timing: ADMISSION_NONE,
  summary:
    "Per-Person signed acknowledgment that the grievance policy was explained. Not an org poster. Empty admission/caseload stays a question.",
  routes: ["IN_PLATFORM"],
  handling:
    "The live grievance acknowledgment form is the handling path, not a generic attestation.",
  memberLabel: "Signed grievance-policy acknowledgment",
  tests: [
    ["positive", "An admitted Person with a signed grievance acknowledgment satisfies the parent."],
    ["negative", "Office staff with no assigned persons do not receive the grievance intake card."],
    ["boundary", "Unknown caseload stays missing-information, never silent N/A."],
  ],
});

export const REQ_1_24_5_SUPPORT_STRATEGIES: DraftRule = fileRule({
  id: "REQ-1.24.5",
  title: "Support strategies — 30 days after PCSP created or updated",
  liveKey: "support_strategies",
  clauses: ["SOW §1.24(5)"],
  predicate: { kind: "support_strategies_assignment", catalogKey: "support_strategies" },
  timing: PCSP_NONE,
  summary:
    "Assigned staff complete the live Support Strategies form after it is published for that Person. Not the SEI UPI support-strategy entry. Missing assignment is a gap, not N/A.",
  routes: ["IN_PLATFORM"],
  handling:
    "The live support-strategies form is the handling path. Do not invent a UPI staff clock.",
  memberLabel: "Support strategies form for the assigned Person",
  tests: [
    [
      "positive",
      "Staff assigned to a Person with a published support-strategies form satisfy the parent.",
    ],
    ["negative", "SEI UPI support-strategy entry does not satisfy this staff form."],
    [
      "boundary",
      "Unknown staff+person assignment stays missing-information. Do not invent hire+30 as this clock.",
    ],
  ],
});

export const REQ_1_35_HOUSEMATE: DraftRule = fileRule({
  id: "REQ-1.35",
  title: "Housemate informed-choice discussion",
  liveKey: "housemate_informed_choice",
  clauses: ["SOW §1.35"],
  predicate: { kind: "awarded_service_codes", catalogKey: "housemate_informed_choice" },
  timing: HOUSEMATE_NONE,
  summary:
    "For awarded HHS, PPS, or RHS: document the informed discussion about who the Person lives with. Required at placement and housemate change. Empty awarded codes stay a question.",
  routes: ["IN_PLATFORM"],
  handling: "The live housemate informed-choice form is the handling path.",
  memberLabel: "Housemate informed-choice discussion notes",
  tests: [
    ["positive", "Awarded HHS/PPS/RHS plus a recorded housemate discussion satisfies the parent."],
    ["negative", "SEI/DSI-only awarded codes do not open the housemate discussion."],
    ["boundary", "Empty awarded-code list stays missing-information, never silent N/A."],
  ],
});

export const REQ_11_3_5_BELONGINGS: DraftRule = fileRule({
  id: "REQ-11.3.5",
  title: "Belongings inventory — keep current",
  liveKey: "belongings_inventory",
  clauses: ["SOW §11.3(5)"],
  predicate: { kind: "awarded_service_codes", catalogKey: "belongings_inventory" },
  timing: BELONGINGS_NONE,
  summary:
    "Live belongings register for awarded HHS, SLH, PPS, or RHS — not SLN. Update as items are added or discarded. Guardian signature for items ≥ $50 stays on the existing trigger. Do not invent an annual-from-completion clock.",
  routes: ["IN_PLATFORM"],
  handling: "The live belongings register is the handling path, not a second annual form.",
  memberLabel: "Current belongings inventory",
  tests: [
    [
      "positive",
      "Awarded HHS/SLH/PPS/RHS plus a current belongings register satisfies the parent.",
    ],
    ["negative", "SLN-only awarded codes do not open the belongings register."],
    [
      "boundary",
      "Empty awarded codes stay missing-information. Do not invent annual-from-completion.",
    ],
  ],
});

export const REQ_11_3_9_HHS_ROOM_BOARD: DraftRule = fileRule({
  id: "REQ-11.3.9",
  title: "HHS room-and-board agreement",
  liveKey: "hhs_room_board_agreement",
  clauses: ["SOW §11.3(9)"],
  predicate: { kind: "awarded_service_codes", catalogKey: "hhs_room_board_agreement" },
  timing: MISSING_NONE,
  summary:
    "Signed HHS room-and-board agreement in the Person file. HCBS Settings Rule note stays on the live form. Empty HHS award stays a question.",
  routes: ["IN_PLATFORM", "UPLOAD"],
  handling: "The live room-and-board form or uploaded agreement is the handling path.",
  memberLabel: "Current HHS room-and-board agreement",
  tests: [
    ["positive", "Awarded HHS plus a signed room-and-board agreement satisfies the parent."],
    ["negative", "RHS-only awarded codes do not open the HHS room-and-board file."],
    [
      "boundary",
      "Timing stays missing-information — do not invent hire+N or annual-from-completion.",
    ],
  ],
});

export const REQ_11_5_HHS_HOME_CERT: DraftRule = fileRule({
  id: "REQ-11.5",
  title: "HHS home certification — annual DSPD form",
  liveKey: "hhs_home_cert_annual",
  clauses: ["SOW §11.5"],
  predicate: { kind: "awarded_service_codes", catalogKey: "hhs_home_cert_annual" },
  timing: HHS_CERT_NONE,
  summary:
    "Inspect each HHS home on the DSPD Host Home Certification form, then upload. One instance per active HHS home. Not a quarterly evac drill and not an annual-outcome report.",
  routes: ["UPLOAD", "EXTERNAL"],
  handling: "Upload of the completed DSPD Host Home Certification form is the handling path.",
  memberLabel: "Current DSPD Host Home Certification per HHS home",
  tests: [
    ["positive", "Awarded HHS plus an uploaded host-home certification satisfies the parent."],
    ["negative", "RHS-only awarded codes do not open the HHS home-cert clock."],
    [
      "boundary",
      "Do not mint hhs_evac_drills_quarterly or hhs_annual_outcome from this parent. Live July 1 is the pack reminder.",
    ],
  ],
});

export const REQ_21_3_1_RHS_LEASE: DraftRule = fileRule({
  id: "REQ-21.3.1",
  title: "RHS lease agreement",
  liveKey: "rhs_lease_agreement",
  clauses: ["SOW §21.3(1)"],
  predicate: { kind: "awarded_service_codes", catalogKey: "rhs_lease_agreement" },
  timing: MISSING_NONE,
  summary:
    "Signed RHS lease in the Person file at placement. HCBS Settings Rule note stays on the live form. Empty RHS award stays a question. Not a quarterly evac parent.",
  routes: ["IN_PLATFORM", "UPLOAD"],
  handling: "The live lease form or uploaded lease is the handling path.",
  memberLabel: "Current RHS lease agreement",
  tests: [
    ["positive", "Awarded RHS plus a signed lease satisfies the parent."],
    ["negative", "HHS-only awarded codes do not open the RHS lease file."],
    [
      "boundary",
      "Timing stays missing-information. Do not mint rhs_evac_drills_quarterly from this parent.",
    ],
  ],
});

export const REQ_21_5_OL_RHS_LICENSE: DraftRule = fileRule({
  id: "REQ-21.5",
  title: "OL Residential Support license — 4+ persons per site",
  liveKey: "ol_rhs_license_4plus",
  clauses: ["SOW §21.5"],
  predicate: { kind: "awarded_service_codes", catalogKey: "ol_rhs_license_4plus" },
  timing: OL_LICENSE_NONE,
  summary:
    "Current OL Residential Support License on the live ol_rhs_license_4plus file. External OL/DLBC portal, then upload. Do not invent the 3-or-fewer certification as this parent.",
  routes: ["EXTERNAL", "UPLOAD"],
  handling: "External OL license plus uploaded confirmation is the handling path.",
  memberLabel: "Current OL Residential Support License (4+ persons)",
  tests: [
    ["positive", "Awarded RHS plus a current uploaded OL 4+ license satisfies the parent."],
    ["negative", "HHS-only awarded codes do not open the OL RHS 4+ license file."],
    [
      "boundary",
      "July 1 is reminder-only. Do not invent ol_rhs_cert_3or_fewer, quarterly evac, or annual-outcome as this clock.",
    ],
  ],
});

const BATCH_FIXTURES: Readonly<Record<string, DraftRule>> = {
  "REQ-1.9": REQ_1_9_CE_COMPANION,
  "REQ-1.10.11": REQ_1_10_11_GRIEVANCE,
  "REQ-1.24.5": REQ_1_24_5_SUPPORT_STRATEGIES,
  "REQ-1.35": REQ_1_35_HOUSEMATE,
  "REQ-11.3.5": REQ_11_3_5_BELONGINGS,
  "REQ-11.3.9": REQ_11_3_9_HHS_ROOM_BOARD,
  "REQ-11.5": REQ_11_5_HHS_HOME_CERT,
  "REQ-21.3.1": REQ_21_3_1_RHS_LEASE,
  "REQ-21.5": REQ_21_5_OL_RHS_LICENSE,
};

export const MEGA_C_BATCH_ENGINE_BINDINGS: readonly MegaCBatchEngineBinding[] = [
  {
    ruleId: "REQ-1.9",
    liveKeys: ["ce_12h_annual"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "companion_of_batch_1",
    evidence: "upload_hours",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "direct_support_assignment",
    disposition: "obligation",
    sharesLiveKeyWith: ["REQ-1.8.7"],
  },
  {
    ruleId: "REQ-1.10.11",
    liveKeys: ["grievance_acknowledgment"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: "Grievance policy acknowledgment",
    reminders: "product_default",
    adminReview: "form_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "person_file_intake",
    disposition: "intake",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.24.5",
    liveKeys: ["support_strategies"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: SUPPORT_STRATEGIES_OBLIGATION_TITLE,
    reminders: "product_default",
    adminReview: "form_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "support_strategies_assignment",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-1.35",
    liveKeys: ["housemate_informed_choice"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: "Housemate informed-choice discussion",
    reminders: "product_default",
    adminReview: "form_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "residential_housemates",
    disposition: "intake",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-11.3.5",
    liveKeys: ["belongings_inventory"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "record_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "belongings_codes",
    disposition: "by_design",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-11.3.9",
    liveKeys: ["hhs_room_board_agreement"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: "Room-and-board / lease agreement",
    reminders: "product_default",
    adminReview: "form_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "hhs_awarded",
    disposition: "intake",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-11.5",
    liveKeys: ["hhs_home_cert_annual"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "upload_file",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "hhs_awarded",
    disposition: "obligation",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-21.3.1",
    liveKeys: ["rhs_lease_agreement"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "in_platform_form",
    trainingTitle: null,
    formTitle: "Room-and-board / lease agreement",
    reminders: "product_default",
    adminReview: "form_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "rhs_awarded",
    disposition: "intake",
    sharesLiveKeyWith: [],
  },
  {
    ruleId: "REQ-21.5",
    liveKeys: ["ol_rhs_license_4plus"],
    parentAssignment: "one",
    mintsElementTasks: false,
    assignment: "caseload_reeval",
    evidence: "external_then_upload",
    trainingTitle: null,
    formTitle: null,
    reminders: "product_default",
    adminReview: "upload_review",
    blocksSoloWhenLapsed: false,
    liveFactKey: "rhs_awarded",
    disposition: "standing",
    sharesLiveKeyWith: [],
  },
];

export const MEGA_C_BATCH_DEMO_PATH = [
  {
    step: "facts",
    title: "Record caseload, awarded codes, and the shared CE assignment",
    detail:
      "Grievance and support strategies follow the Person assignment. Housemate, belongings, room/board, HHS cert, RHS lease, and OL 4+ license follow awarded HHS/RHS/PPS/SLH. REQ-1.9 reuses the batch-1 direct-support CE fact. Empty stays a question.",
  },
  {
    step: "task",
    title: "One parent card per live key",
    detail:
      "REQ-1.9 shares ce_12h_annual with REQ-1.8.7 — one CE card, not two. Child file items stay on the parent. Do not mint evac or annual-outcome cards.",
  },
  {
    step: "evidence",
    title: "Use the live person-file / site form or upload",
    detail:
      "CE hours on the shared file. Grievance, support strategies, housemate, room/board, and lease use the live forms. Belongings stays on the register. HHS cert and OL license are upload/external.",
  },
  {
    step: "review",
    title: "Admin accepts on the existing form/upload review",
    detail:
      "Submitted forms and uploads sit in review. Product reminders go to the reviewer. Acceptance greens the parent. Soft=none — this batch does not publish.",
  },
  {
    step: "renewal",
    title: "Re-verify on the live due rule only",
    detail:
      "CE renews on the batch-1 hire-anniversary year 2 rule. Intake files are keep-current. HHS cert uses the live calendar_year reminder. OL license re-verifies on printed expiry. Do not invent annual-from-completion.",
  },
] as const;

export function isMegaCExecutableBatchRuleId(ruleId: string): boolean {
  return (MEGA_C_EXECUTABLE_BATCH_RULE_IDS as readonly string[]).includes(ruleId);
}

export function isMegaCExecutableBatchLiveKey(key: string): boolean {
  return (MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[]).includes(key);
}

export function megaCBatchFixtureFor(ruleId: string): DraftRule | null {
  return BATCH_FIXTURES[ruleId] ?? null;
}

export function liveFactIdForMegaCBatchKey(factKey: MegaCBatchLiveFactKey): string {
  if (factKey === "hhs_awarded") return "FACT-004";
  if (factKey === "rhs_awarded") return "FACT-007";
  return `LIVE-${factKey}`;
}

const LIVE_FACT_QUESTIONS: Record<MegaCBatchLiveFactKey, string> = {
  direct_support_assignment: "Which staff have a direct-support assignment?",
  person_file_intake: "Which persons are admitted or receiving first service?",
  support_strategies_assignment: "Which staff are assigned to which persons?",
  residential_housemates: "Which DSPD service codes is this contractor awarded?",
  belongings_codes: "Which DSPD service codes is this contractor awarded?",
  hhs_awarded: "Agency awarded HHS?",
  rhs_awarded: "Agency awarded RHS?",
};

export function megaCBatchLiveFactsForRule(ruleId: string): CatalogFact[] {
  const binding = MEGA_C_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId);
  if (!binding) return [];
  return [
    {
      fact_id: liveFactIdForMegaCBatchKey(binding.liveFactKey),
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

export function applyMegaCExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  const fixture = megaCBatchFixtureFor(rule.id);
  if (!fixture || !isMegaCExecutableBatchRuleId(rule.id)) return rule;
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
          applicabilityFacts: mergeCatalogFacts(existingFacts, megaCBatchLiveFactsForRule(rule.id)),
        }
      : {}),
  };
}

export function applyMegaCExecutableBatchOverlayAll<T extends DraftRule>(rules: readonly T[]): T[] {
  return rules.map((rule) => applyMegaCExecutableBatchOverlay(rule));
}

export function megaCExecutableBatchParents(
  parents: readonly LoadedDraftRule[],
): LoadedDraftRule[] {
  return parents
    .filter((rule) => isMegaCExecutableBatchRuleId(rule.id))
    .map((rule) => applyMegaCExecutableBatchOverlay(rule));
}

export function megaCBatchBindingForRule(ruleId: string): MegaCBatchEngineBinding | null {
  return MEGA_C_BATCH_ENGINE_BINDINGS.find((row) => row.ruleId === ruleId) ?? null;
}

export function megaCBatchLiveEngineReady(binding: MegaCBatchEngineBinding): {
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
    const key = binding.liveKeys[0];
    const entry = key ? sowCatalogEntryByKey(key) : null;
    const packTitle = entry?.form_template?.title;
    const allowed =
      binding.formTitle === SUPPORT_STRATEGIES_OBLIGATION_TITLE ||
      (packTitle != null &&
        (binding.formTitle === packTitle ||
          binding.formTitle.toLowerCase() === packTitle.toLowerCase()));
    if (!allowed) {
      reasons.push(`${binding.ruleId} formTitle is not the live pack form.`);
    }
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
    binding.ruleId === "REQ-1.9" &&
    (binding.sharesLiveKeyWith[0] !== "REQ-1.8.7" || binding.assignment !== "companion_of_batch_1")
  ) {
    reasons.push("REQ-1.9 must stay a companion of REQ-1.8.7 on ce_12h_annual.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function megaCBatchAssignmentOpensClock(
  liveKey: MegaCExecutableBatchLiveKey,
  staff: StaffDutyFacts,
  orgFacts: OrgFacts | null = null,
): boolean {
  if (liveKey === "grievance_acknowledgment") {
    if (!staff.assignmentsKnown) return false;
    return staff.assignedClientIds.length > 0;
  }
  if (
    liveKey === "housemate_informed_choice" ||
    liveKey === "belongings_inventory" ||
    liveKey === "hhs_room_board_agreement" ||
    liveKey === "hhs_home_cert_annual" ||
    liveKey === "rhs_lease_agreement" ||
    liveKey === "ol_rhs_license_4plus"
  ) {
    const entry = sowCatalogEntryByKey(liveKey);
    return (
      awardedCodeDutyStatus(entry?.service_codes ?? [], orgFacts?.servicesOffered ?? []) ===
      "applies"
    );
  }
  return staffReceivesDutyClock(
    evaluateStaffDuty({ dutyKey: liveKey, staff, orgFacts: orgFacts ?? undefined }),
  );
}

export function megaCBatchPublicationStaysDeliberate(rule: DraftRule): boolean {
  if (VERIFIED_PUBLICATIONS.some((row) => row.ruleId === rule.id)) return false;
  return canPublish(rule) && !canActivate(rule) && rule.publication === "not_published";
}

export function megaCBatchParentIsWired(rule: DraftRule): boolean {
  if (!isMegaCExecutableBatchRuleId(rule.id)) return false;
  const overlaid = applyMegaCExecutableBatchOverlay(rule);
  const liveKey = liveObligationKeyForRule(overlaid);
  if (!liveKey || !isMegaCExecutableBatchLiveKey(liveKey)) return false;
  const policy = staffTaskPolicyForRule(overlaid);
  if (policy.role === "element") return false;
  if (overlaid.group.parentAssignment !== "one") return false;
  return canPublish(overlaid);
}

export function megaCBatchSharedLiveKeyParents(liveKey: string): string[] {
  return MEGA_C_BATCH_ENGINE_BINDINGS.filter((row) =>
    row.liveKeys.includes(liveKey as MegaCExecutableBatchLiveKey),
  ).map((row) => row.ruleId);
}

export function megaCBatchOmitsInventedEvacOutcomesAndPn(): boolean {
  const keys = MEGA_C_EXECUTABLE_BATCH_LIVE_KEYS as readonly string[];
  const rules = MEGA_C_EXECUTABLE_BATCH_RULE_IDS as readonly string[];
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
    !keys.includes("client_specific_training") &&
    !keys.includes("pps_foster_license") &&
    !rules.includes("REQ-1.9.6") &&
    !rules.includes("REQ-8.6") &&
    !rules.includes("REQ-11.3") &&
    !rules.includes("REQ-11.7") &&
    !rules.includes("REQ-18.5") &&
    !rules.includes("REQ-19.2.7") &&
    !rules.includes("REQ-20.3") &&
    !rules.includes("REQ-21.3") &&
    !rules.includes("REQ-30.7")
  );
}
